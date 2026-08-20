import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
export declare function listJobTasks(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function saveJobTasks(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function updateTask(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function deleteTask(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getCompletions(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function tickCompletion(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function submitFormCompletion(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function submitImageCompletion(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function reviewCompletion(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function employerForceComplete(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function employerReopenTask(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getCompletionImageUrl(req: AuthenticatedRequest, res: Response): Promise<void>;
export declare function getPublicPipeline(req: any, res: any): Promise<void>;
//# sourceMappingURL=pipeline.controller.d.ts.map