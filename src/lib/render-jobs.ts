import { db, now } from "@/lib/db/client";
import { saveDownloadedVideo } from "@/lib/video-library";

type RenderJobRow = {
    id: string;
    status: "pending" | "processing" | "completed" | "downloaded" | "failed";
    video_url: string | null;
    error: string | null;
    openrouter_job_id: string | null;
    openrouter_polling_url: string | null;
    last_queried: string | null;
    last_query_status: string | null;
};

type OpenRouterVideoResponse = {
    status?: string;
    video_url?: string | null;
    url?: string | null;
    urls?: string[];
    unsigned_urls?: string[];
    error?: string;
};

const LOCAL_VIDEO_PREFIX = "/api/assets/videos/";

function isLocalVideoUrl(value: string | null | undefined) {
    return Boolean(value && (value.startsWith(LOCAL_VIDEO_PREFIX) || value.startsWith("/uploads/videos/")));
}

function getOpenRouterVideoUrl(data: OpenRouterVideoResponse) {
    return data.unsigned_urls?.[0] || data.video_url || data.url || (Array.isArray(data.urls) ? data.urls[0] : null);
}

function getOpenRouterPollingUrl(job: RenderJobRow) {
    if (job.openrouter_polling_url) {
        return job.openrouter_polling_url;
    }

    if (!job.openrouter_job_id) {
        return null;
    }

    return `https://openrouter.ai/api/v1/videos/generation?id=${encodeURIComponent(job.openrouter_job_id)}`;
}

export async function refreshRenderJob(job: RenderJobRow) {
    const pollingUrl = getOpenRouterPollingUrl(job);

    if (job.status === "downloaded" || job.status === "failed") {
        return job;
    }

    const queriedAt = now();

    async function downloadAndStoreVideo(sourceUrl: string) {
        const savedVideo = await saveDownloadedVideo({
            jobId: job.id,
            sourceUrl,
        });

        if (!savedVideo) {
            return null;
        }

        return savedVideo.publicUrl;
    }

    async function persistDownloadedJob(videoUrl: string, lastQueryStatus: string) {
        db.prepare(`
        UPDATE render_jobs
        SET status = ?, video_url = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("downloaded", videoUrl, null, queriedAt, lastQueryStatus, queriedAt, job.id);

        return {
            ...job,
            status: "downloaded" as const,
            video_url: videoUrl,
            error: null,
            last_queried: queriedAt,
            last_query_status: lastQueryStatus,
        };
    }

    if (job.status === "completed") {
        try {
            if (isLocalVideoUrl(job.video_url)) {
                return persistDownloadedJob(job.video_url as string, job.last_query_status ?? "downloaded");
            }

            if (job.video_url) {
                const downloadedUrl = await downloadAndStoreVideo(job.video_url);
                if (!downloadedUrl) {
                    return job;
                }
                return persistDownloadedJob(downloadedUrl, job.last_query_status ?? "downloaded");
            }

            if (!pollingUrl) {
                return job;
            }

            const response = await fetch(pollingUrl, {
                headers: {
                    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
                },
            });

            if (!response.ok) {
                const queryError = `OpenRouter query failed with ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
                db.prepare(`
        UPDATE render_jobs
        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("failed", queryError, queriedAt, "error", queriedAt, job.id);

                return {
                    ...job,
                    status: "failed",
                    error: queryError,
                    last_queried: queriedAt,
                    last_query_status: "error",
                };
            }

            const data = (await response.json()) as OpenRouterVideoResponse;
            const lastQueryStatus = data.status ?? "unknown";
            const sourceUrl = getOpenRouterVideoUrl(data);

            if (!sourceUrl) {
                const queryError = "OpenRouter completed without a video URL";
                db.prepare(`
        UPDATE render_jobs
        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("failed", queryError, queriedAt, lastQueryStatus, queriedAt, job.id);

                return {
                    ...job,
                    status: "failed",
                    error: queryError,
                    last_queried: queriedAt,
                    last_query_status: lastQueryStatus,
                };
            }

            const downloadedUrl = await downloadAndStoreVideo(sourceUrl);
            if (!downloadedUrl) {
                return job;
            }
            return persistDownloadedJob(downloadedUrl, lastQueryStatus);
        } catch (error) {
            const queryError = error instanceof Error ? error.message : "Failed to download completed video";
            console.error("Failed to download completed render:", error);
            db.prepare(`
        UPDATE render_jobs
        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("failed", queryError, queriedAt, "error", queriedAt, job.id);

            return {
                ...job,
                status: "failed",
                error: queryError,
                last_queried: queriedAt,
                last_query_status: "error",
            };
        }
    }

    if (!pollingUrl) {
        return job;
    }

    try {
        const response = await fetch(pollingUrl, {
            headers: {
                Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
            },
        });

        if (!response.ok) {
            const queryError = `OpenRouter query failed with ${response.status}${response.statusText ? ` ${response.statusText}` : ""}`;
            db.prepare(`
        UPDATE render_jobs
        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("failed", queryError, queriedAt, "error", queriedAt, job.id);

            return {
                ...job,
                status: "failed",
                error: queryError,
                last_queried: queriedAt,
                last_query_status: "error",
            };
        }

        const data = (await response.json()) as OpenRouterVideoResponse;
        let updatedStatus: RenderJobRow["status"] = job.status;
        let videoUrl = job.video_url;
        let error = job.error;
        const lastQueryStatus = data.status ?? "unknown";

        if (data.status === "completed" || data.status === "success") {
            const sourceUrl = getOpenRouterVideoUrl(data) || job.video_url;

            if (!sourceUrl) {
                const queryError = "OpenRouter completed without a video URL";
                db.prepare(`
        UPDATE render_jobs
        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
      `).run("failed", queryError, queriedAt, lastQueryStatus, queriedAt, job.id);

                return {
                    ...job,
                    status: "failed",
                    error: queryError,
                    last_queried: queriedAt,
                    last_query_status: lastQueryStatus,
                };
            }

            videoUrl = await downloadAndStoreVideo(sourceUrl);
            if (!videoUrl) {
                return job;
            }
            updatedStatus = "downloaded";
            error = null;
        } else if (data.status === "failed") {
            updatedStatus = "failed";
            error = data.error || "OpenRouter generation failed";
        }

        if (updatedStatus !== job.status) {
            db.prepare(`
        UPDATE render_jobs
                SET status = ?, video_url = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
        WHERE id = ?
            `).run(updatedStatus, videoUrl, error, queriedAt, lastQueryStatus, queriedAt, job.id);

            return {
                ...job,
                status: updatedStatus,
                video_url: videoUrl,
                error,
                last_queried: queriedAt,
                last_query_status: lastQueryStatus,
            };
        }

        db.prepare(`
      UPDATE render_jobs
            SET last_queried = ?, last_query_status = ?, updated_at = ?
      WHERE id = ?
        `).run(queriedAt, lastQueryStatus, queriedAt, job.id);

        return {
            ...job,
            last_queried: queriedAt,
            last_query_status: lastQueryStatus,
        };
    } catch (error) {
        const queryError = error instanceof Error ? error.message : "Failed to poll OpenRouter";
        console.error("Failed to poll OpenRouter:", error);
        db.prepare(`
            UPDATE render_jobs
                        SET status = ?, error = ?, last_queried = ?, last_query_status = ?, updated_at = ?
            WHERE id = ?
                `).run("failed", queryError, queriedAt, "error", queriedAt, job.id);

        return {
            ...job,
            status: "failed",
            error: queryError,
            last_queried: queriedAt,
            last_query_status: "error",
        };
    }

    return job;
}

export async function refreshProcessingRenderJobs(workspaceId: string) {
    const jobs = db
        .prepare(
            `
                SELECT id, status, video_url, error, openrouter_job_id, openrouter_polling_url, last_queried, last_query_status
        FROM render_jobs
        WHERE workspace_id = ?
                    AND (
                        status = 'completed'
                        OR (
                            status IN ('pending', 'processing')
                            AND (openrouter_job_id IS NOT NULL OR openrouter_polling_url IS NOT NULL)
                        )
                    )
        ORDER BY created_at DESC
      `,
        )
        .all(workspaceId) as RenderJobRow[];

    return Promise.all(jobs.map((job) => refreshRenderJob(job)));
}
