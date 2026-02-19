/** Entry point — barrel file re-exporting from submodules */
export { createUser, deleteUser } from "./services/user-service.js";
export { formatDate } from "./utils/format.js";
export type { User } from "./models/user.js";
export { fetchData } from "./services/api-client.js";
