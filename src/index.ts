import express from "express";
import type { Request, Response } from "express";
import { rateLimiter } from "./middleware/fixedWindow";
const app = express();
const PORT = 3000;

const apiRouter = express.Router();

app.use(rateLimiter);
apiRouter.get("/service1", (req: Request, res: Response) => {
  res.json({
    status: `API is running successfully `,
    service: "Service 1",
  });
});

app.use("/api", apiRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
