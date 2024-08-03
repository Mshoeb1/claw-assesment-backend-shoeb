const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { open } = require("sqlite");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(bodyParser.json());

app.use(cors());

const dbPath = path.join(__dirname, "userData.db");

let loginDb = null;

// Initializing Db Server
const initializeDBAndServer = async () => {
  try {
    loginDb = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    console.log("file open");
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Initializing connection with database
const db = new sqlite3.Database(
  "./userData.db",
  sqlite3.OPEN_READWRITE,
  (err) => {
    if (err) {
      return console.error(err.message);
    }
    console.log("Connected to the in-memory SQlite database.");
  }
);

// Creating databases like users and todos_items

db.serialize(() => {
  db.run(
    "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Created table "users"');
      }
    }
  );

  db.run(
    "CREATE TABLE todo_items (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, description TEXT, status TEXT)",
    (err) => {
      if (err) {
        console.error(err.message);
      } else {
        console.log('Created table "todo_items"');
      }
    }
  );
});

// Modeling user authentication api

app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  const selectUser = `SELECT * FROM users WHERE username='${username}';`;
  const userData = await loginDb.get(selectUser);
  if (userData !== undefined) {
    const isPasswordMatched = await bcrypt.compare(password, userData.password);
    if (userData && isPasswordMatched) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      res.status(200);
      res.json({
        id: userData.id,
        jwt_token: jwtToken,
      });
    } else {
      res.status(401);
      res.send("Invalid Password Entered");
    }
  } else {
    res.status(401);
    res.send("Invalid Username and Password");
  }
});

// Modeling user's details database

app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const row = db.run(
    `INSERT INTO users (username, password) VALUES (?, ?)`,
    [username, hashedPassword],
    function (err) {
      if (err) {
        if (err.code === "SQLITE_CONSTRAINT") {
          return res.status(400).json({ error: "Email already exists" });
        }
        return res.status(500).json({ error: err.message });
      }
    }
  );
  if (row) {
    const payload = {
      username: username,
    };
    const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN", {
      expiresIn: "30d",
    });
    res.json({
      jwt_tokent: jwtToken,
    });
  } else {
    res.status(400);
    res.send("User Registration Error");
  }
});

// Modeling todos dataBase

app.post("/todos", (req, res) => {
  const { userId, description, status, jwtToken } = req.body;
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        db.run(
          ` INSERT INTO todo_items (user_id, description, status) VALUES (?, ?, ?);`,
          [userId, description, status]
        );
      }
    });
  }
});

// Fetching all todos of specific user
app.get("/todos", async (req, res) => {
  const userId = parseInt(req.headers["id"]);
  console.log(userId);
  let jwtToken;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        const todos = await db.all(
          `SELECT * FROM todo_items WHERE user_id = ?;`,
          [userId]
        );
        res.status(200);
        res.json(todos);
        console.log(todos);
      }
    });
  }
});

// updating todo API of specefic user

app.put("/todos/:id", async (req, res) => {
  const [userId, description, status] = req.body;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        db.run(
          ` UPDATE todo_items SET description = ?, status = ? WHERE id = ?;`,
          [description, status, userId]
        );
      }
    });
  }
});

// On Delete todo API of specific user

app.delete("/delete/:id", async (req, response) => {
  const [userId] = req.body;
  const authHeader = req.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid Access Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid Access Token");
      } else {
        db.run(` DELETE FROM todo_items WHERE id = ?;`, [userId]);
      }
    });
  }
});

const PORT = process.env.PORT || 4002;
console.log(PORT);
app.listen(PORT, console.log("Server is running on 4002 port!"));
