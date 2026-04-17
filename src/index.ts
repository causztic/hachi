import { createApp } from "./app";

const app = await createApp();

const stop = async () => {
  await app.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void stop();
});
process.on("SIGTERM", () => {
  void stop();
});

await app.start();
