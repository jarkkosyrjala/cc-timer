import { z } from "zod";

export const JobStatusSchema = z.enum([
  "pending",
  "dispatched",
  "canceled",
  "failed",
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobRecordSchema = z.object({
  id: z.string(),
  status: JobStatusSchema,
  createdAt: z.string(),
  dueAt: z.string(),
  delaySeconds: z.number().int().nonnegative(),
  cwd: z.string(),
  claudeBin: z.string(),
  tasks: z.array(z.string()),
  claudeArgs: z.array(z.string()).optional(),
  schedulerPid: z.number().int().optional(),
  schedulerToken: z.string(),
  logFile: z.string(),
  dispatchedAt: z.string().optional(),
  completedAt: z.string().optional(),
  error: z.string().optional(),
});

export type JobRecord = z.infer<typeof JobRecordSchema>;

export const JobsFileSchema = z.object({
  version: z.literal(1),
  jobs: z.array(JobRecordSchema),
});

export type JobsFile = z.infer<typeof JobsFileSchema>;
