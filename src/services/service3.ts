import express from "express";

import type { Request, Response } from "express";

const app = express();

const PORT = 3003;

app.get("/service1", (req: Request, res: Response) => {
  res.json({
    status: `API is running successfully `,
    service: "Service 1",
  });
});
app.listen(PORT, () => {
  console.log(`Service 1 running on http://localhost:${PORT}`);
});
