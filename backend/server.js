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
app.use(express.json());

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

// Helper funkcija za standardizirane odgovore
const createResponse = (status, message, data = null) => ({
  status,
  message,
  response: data,
});

// GET sve timove
app.get("/api/allTeams", async (req, res) => {
  try {
    const result = await client.query("SELECT * FROM teams");
    res.json(createResponse("OK", "Fetched all teams", result.rows));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(createResponse("Internal Server Error", "Failed to fetch teams"));
  }
});

// GET tim prema ID-u
app.get("/api/teams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query("SELECT * FROM teams WHERE id = $1", [
      id,
    ]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", "Team with the provided ID doesn't exist")
        );
    }
    res.json(createResponse("OK", "Fetched team object", result.rows[0]));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(createResponse("Internal Server Error", "Failed to fetch team"));
  }
});

// Dohvati sve timove iz određene divizije
app.get("/api/teams/division/:division", async (req, res) => {
  const { division } = req.params;

  try {
    const result = await client.query(
      "SELECT * FROM teams WHERE division ILIKE $1",
      [division]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", `No teams found in division ${division}`)
        );
    }
    res.json(
      createResponse("OK", `Fetched teams in division ${division}`, result.rows)
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(
        createResponse(
          "Internal Server Error",
          "Failed to fetch teams by division"
        )
      );
  }
});

// Dohvati timove koji su osvojili određeni broj naslova
app.get("/api/teams/titles/:count", async (req, res) => {
  const { count } = req.params;

  try {
    const result = await client.query("SELECT * FROM teams WHERE titles = $1", [
      parseInt(count),
    ]);
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", `No teams with ${count} titles found`)
        );
    }
    res.json(
      createResponse("OK", `Fetched teams with ${count} titles`, result.rows)
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(
        createResponse(
          "Internal Server Error",
          "Failed to fetch teams by titles"
        )
      );
  }
});

// Dohvati sve timove osnovane prije određene godine
app.get("/api/teams/founded-before/:year", async (req, res) => {
  const { year } = req.params;

  try {
    const result = await client.query(
      "SELECT * FROM teams WHERE founded < $1",
      [parseInt(year)]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", `No teams founded before ${year} found`)
        );
    }
    res.json(
      createResponse("OK", `Fetched teams founded before ${year}`, result.rows)
    );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(
        createResponse("Internal Server Error", "Failed to fetch teams by year")
      );
  }
});

// POST novi tim
app.post("/api/teams", async (req, res) => {
  const { name, city, founded, stadium, division, titles } = req.body;
  try {
    const result = await client.query(
      "INSERT INTO teams (name, city, founded, stadium, division, titles) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [name, city, founded, stadium, division, titles]
    );
    res
      .status(201)
      .json(
        createResponse("Created", "Team successfully created", result.rows[0])
      );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(createResponse("Internal Server Error", "Failed to create team"));
  }
});

// PUT ažuriranje tima prema ID-u
app.put("/api/teams/:id", async (req, res) => {
  const { id } = req.params;
  const { name, city, founded, stadium, division, titles } = req.body;
  try {
    const result = await client.query(
      "UPDATE teams SET name = $1, city = $2, founded = $3, stadium = $4, division = $5, titles = $6 WHERE id = $7 RETURNING *",
      [name, city, founded, stadium, division, titles, id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", "Team with the provided ID doesn't exist")
        );
    }
    res.json(createResponse("OK", "Team successfully updated", result.rows[0]));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(createResponse("Internal Server Error", "Failed to update team"));
  }
});

// DELETE tim prema ID-u
app.delete("/api/teams/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const result = await client.query(
      "DELETE FROM teams WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json(
          createResponse("Not Found", "Team with the provided ID doesn't exist")
        );
    }
    res.json(createResponse("OK", "Team successfully deleted", result.rows[0]));
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json(createResponse("Internal Server Error", "Failed to delete team"));
  }
});

app.use((req, res) => {
  res.status(404).json(createResponse("Not Found", "Endpoint not found"));
});

// Middleware za rukovanje greškama
app.use((err, req, res, next) => {
  console.error(err);
  res
    .status(500)
    .json(
      createResponse("Internal Server Error", "An unexpected error occurred")
    );
});

//ewerfwefwew
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}...`);
});
