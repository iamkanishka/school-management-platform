const { app } = require("./app.js");
const { env } = require("./config");

const PORT = env.PORT || 5007;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);                                                                                                                                                
});
