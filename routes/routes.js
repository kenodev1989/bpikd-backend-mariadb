import express from "express";
import userRoutes from "./admin.js";
import headerRoutes from "./headerRoutes.js";
import personsRoutes from "./personsRoutes.js";
import footerRoutes from "./footerRoutes.js";
import sortRoutes from "./sortRoutes.js";
import postRoutes from "./postRoutes.js";
import partnersRoutes from "./partnersRoutes.js";
import searchRoutes from "./searchRoutes.js";
import visitorsRoute from "./vistiorsRoute.js";
import textSettingRoutes from "./textSettingRoutes.js";
import themeRoutes from "./themeRoutes.js";
import backupRoutes from "./backupRoutes.js";

const app = express();

app.use("/", userRoutes);

app.use("/sort", sortRoutes);

app.use("/", express.static("public/works"));
app.use("/", express.static("public"));

app.use("/settings", textSettingRoutes);

app.use("/footer", footerRoutes);

app.use("/theme", themeRoutes);

app.use("/header", headerRoutes);

app.use("/post/persons", personsRoutes);

app.use("/post", postRoutes);
app.use("/post/partners", partnersRoutes);

app.use("/search", searchRoutes);

app.use("/visitors", visitorsRoute);

app.use("/download", backupRoutes);

export default app;
