import { initBotId } from "botid/client/core";

initBotId({
  protect: [
    { path: "/join", method: "POST" },
    { path: "/signup/*", method: "POST" },
  ],
});
