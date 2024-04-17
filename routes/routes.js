import express from "express";
import userRoutes from "./admin.js";
import headerRoutes from "./headerRoutes.js";
import personsRoutes from "./personsRoutes.js";
import footerRoutes from "./footerRoutes.js";
/* import sortRoutes from "./sortRoutes.js"; */

/* const wordsRoutes = require("./words"); */

const app = express();

app.use("/", userRoutes);
/* app.use('/post', postRoutes);

app.use('/sort', sortRoutes); */

// Serve static files from the public/uploads directory
app.use("/uploads", express.static("public/uploads"));

app.use("/footer", footerRoutes);

app.use("/header", headerRoutes);

app.use("/post/persons", personsRoutes);
/* app.use("/words", wordsRoutes); */

export default app;
