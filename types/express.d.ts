import type { Types } from "mongoose";

export interface AuthenticatedUser {
    _id: Types.ObjectId;
    name: string;
    username: string;
    isAdmin: boolean;
    tokenVersion: number;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser | null;
            responseMode?: "json" | "html";
        }

        interface Locals {
            cspNonce: string;
            user: AuthenticatedUser | null;
            currentPath: string;
        }
    }

    interface Console {
        __loggerPatched?: boolean;
    }

    namespace NodeJS {
        interface Process {
            __loggerErrorHandlersInstalled?: boolean;
        }
    }
}

export {};
