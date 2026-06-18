import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import activitiesRouter from "./activities";
import scheduledActivitiesRouter from "./scheduledActivities";
import lessonsRouter from "./lessons";
import sacramentRouter from "./sacrament";
import substitutionsRouter from "./substitutions";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(activitiesRouter);
router.use(scheduledActivitiesRouter);
router.use(lessonsRouter);
router.use(sacramentRouter);
router.use(substitutionsRouter);
router.use(dashboardRouter);

export default router;
