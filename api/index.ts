import express from "express";
import odb from "oracledb";
import type { Pool } from "oracledb";
import cors from "cors";
import { promises as fs } from "fs";
import bodyParser from "body-parser";

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

let pool: Pool;

interface CostPayload {
  vehicleData: string[][];
  total: number;
}

async function initDb() {
  try {
    pool = await odb.createPool({
      user: "system",
      password: "lolxd5",
      connectionString: "localhost/deep",
    });

    let conn = await pool.getConnection();

    const data = await fs.readFile("sql/create_table.sql", {
      encoding: "utf8",
    });
    const commands = data.split(";");

    for (let i = 0; i < commands.length - 1; i++) {
      try {
        await conn.execute(`${commands[i]}`);
      } catch (e) {
        console.log("Table already created");
      }
    }

    await conn.close();
  } catch (err) {
    console.error(err);
  }
}

app
  .route("/api/tables/:id")
  .get(async (req, res) => {
    let conn = await pool.getConnection();

    let data = await conn.execute(`SELECT * FROM ${req.params.id}`);
    res.send(data);

    await conn.close();
  })
  .post(async (req, res) => {
    let conn = await pool.getConnection();
    let values: string[] = req.body.data;

    try {
      let data = await conn.execute(
        `INSERT INTO ${req.params.id} VALUES(${values
          .map((_, i) => `:${i}`)
          .join(",")})`,
        values
      );
      res.send("Success");

      await conn.commit();
    } catch (e) {
      res.send("Invalid data entered");
    } finally {
      await conn.close();
    }
  })
  .patch(async (req, res) => {
    let conn = await pool.getConnection();
    let payload: any = req.body;

    let params = payload.headers.map((e: string, i: number) => {
      return `${e} = :${i}`;
    });

    let condition;
    if (payload.pkey.length === 2) {
      condition = `${payload.pkey[0]} = '${payload.pkeyData[0]}' AND ${payload.pkey[1]} = ${payload.pkeyData[1]}`;
    } else {
      condition = `${payload.pkey[0]} = '${payload.pkeyData[0]}'`;
    }

    try {
      let data = await conn.execute(
        `UPDATE ${req.params.id} SET ${params.join(",")} WHERE ${condition}`,
        payload.data
      );
      res.send("Success");

      await conn.commit();
    } catch (e) {
      res.send("Invalid data entered");
    } finally {
      await conn.close();
    }
  });

app.get("/api/cost", async (req, res) => {
  let conn = await pool.getConnection();

  try {
    let data = await conn.execute(
      "SELECT vehicleid, SUM(totalcost) FROM cost NATURAL JOIN trip NATURAL JOIN vehicle_involved GROUP BY vehicleid"
    );
    console.log(JSON.stringify(data));
    const rows: any = data.rows;

    const total: number = rows
      .map((e: string[]) => Number(e[1]))
      .reduce((prev: number, cur: number) => prev + cur);

    const payload: CostPayload = { vehicleData: rows, total: total };
    console.log(payload);

    res.send(JSON.stringify(payload));
  } catch (e) {
    console.log(e);

    res.send({ message: "Cannot calculate cost" });
  } finally {
    await conn.close();
  }
});

app.get("/", (req, res) => {
  res.send("Test endpoint");
});

await initDb();
app.listen(port, () => {
  console.log(`App listening on http://localhost:${port}`);
});
