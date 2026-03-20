declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        walletAddress: string;
      };
    }
  }
}

export {};
