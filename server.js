const express = require("express");
const { Client } = require("pg");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const PORT = 5004;

const client = new Client({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

app.use(
  cors({
    origin: "http://127.0.0.1:5500",
  })
);

app.use("/public", express.static("public"));

client.connect();

app.get("/api/teams", async (req, res) => {
  const search = req.query.search || "";
  const attribute = req.query.attribute || "";

  let query = "SELECT * from teams JOIN players ON teams.id = players.team";
  const values = [];

  if (search) {
    if (attribute === "wildcard") {
      query += ` WHERE name ILIKE $1 
                 OR city ILIKE $1 
                 OR stadium ILIKE $1 
                 OR division ILIKE $1 
                 OR conference ILIKE $1 
                 OR coach ILIKE $1 
                 OR owner ILIKE $1 
                 OR webpage ILIKE $1 
                 OR CAST(founded AS TEXT) ILIKE $1 
                 OR CAST(titles AS TEXT) ILIKE $1
                 OR playername ILIKE $1 
                 OR playersurname ILIKE $1
                 OR CAST(jerseynumber AS TEXT) ILIKE $1
                 OR position ILIKE $1`;
      values.push(`%${search}%`);
    } else if (["titles", "founded", "jerseynumber"].includes(attribute)) {
      query += ` WHERE ${attribute} = $1`;
      values.push(parseInt(search));
    } else {
      query += ` WHERE ${attribute} ILIKE $1`;
      values.push(`%${search}%`);
    }
  }

  try {
    let result = null;
    if (search) {
      result = await client.query(query, values);
    } else {
      result = await client.query(query);
    }
    res.json(result.rows);
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}...`);
});
