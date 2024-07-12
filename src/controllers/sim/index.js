import { Router, json } from "express";
import { connection } from "../../db/mysql.js";
import dotenv from "dotenv";

dotenv.config();

const router = Router();
const pathName = "/sim";

// 글쓰기
const addUser = (req, res, next) => {
  const { name, phoneNumber } = req.body;

  const addUserQuery = `INSERT INTO Simbongsa (name, phoneNumber) VALUE (?, ?);`;
  const deDuplicationUserQuery = `select * from Simbongsa where phoneNumber = ?`;

  connection.query(deDuplicationUserQuery, phoneNumber, (err, result) => {
    if (err) {
      return res.status(500).json({ Error: err.message });
    }

    if (result.length !== 0) {
      res
        .status(200)
        .json({ errorCode: 4003, success: "이미 등록된 휴대폰 번호" });
    } else {
      connection.query(addUserQuery, [name, phoneNumber], (err, result) => {
        if (err) {
          return res.status(500).json({ Error: err.message });
        }
        res.status(200).json({ success: "성공" });
      });
    }
  });
};

router.post("/user", addUser);

export default {
  router,
  pathName,
};
