import { Router, type IRouter } from "express";
import healthRouter from "./health";
import nyceloRouter from "./nycelo";

const router: IRouter = Router();

router.use(healthRouter);
router.use(nyceloRouter);

export default router;
