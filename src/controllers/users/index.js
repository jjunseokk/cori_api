import { Router } from "express";
import { connection } from "../../db/mysql.js";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';


const router = Router();
const path = "/users";

const getUser = (req, res, next) => {
  try {
    res.status(200).json({ success: "데이터" });
  } catch {}
};

const createUser = (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPw) => {
      if (err) {
        return res
          .status(500)
          .json({ Error: "비밀번호 해싱 중 오류가 발생했습니다." });
      }

      const getQuery = `SELECT * FROM User WHERE email = ?`;
      connection.query(getQuery, email, (error, result) => {
        if (error) {
          return res.status(500).json({ Error: "데이터베이스 오류" });
        }

        if (result.length > 0) {
          return res.json({
            error: "이미 가입된 이메일입니다.",
            type: "error",
          });
        }

        const insertQuery = `INSERT INTO User (name, email, password) VALUES (?, ?, ?)`;
        connection.query(
          insertQuery,
          [name, email, hashedPw],
          (error, result) => {
            if (error) {
              return res.status(500).json({ Error: "서버 내부 오류" });
            }
            res.json({ success: true });
          }
        );
      });
    });
  } catch (err) {
    next(err);
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const getQuery = `SELECT * FROM User WHERE email = ?`;

    connection.query(getQuery, email, (error, result) => {
      if (error) {
        return res.status(500).json({ Error: "서버 내부 오류" });
      }

      bcrypt.compare(password, result[0].password, (err, same) => {
        if (err) {
          return res
            .status(500)
            .json({ Error: "비밀번호 해싱 중 오류가 발생했습니다." });
        } else if (same === true) {
          res.json({ success: result });
        }
      });
    });
  } catch (err) {
    next(err);
  }
};

router.get("/", getUser);
router.post("/", createUser);
router.post("/login", loginUser);

export default {
  router,
  path,
};
