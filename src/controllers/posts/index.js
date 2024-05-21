import { Router } from "express";
import { connection } from "../../db/mysql.js";
import bcrypt, { hash } from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import moment from "moment";

dotenv.config();

const router = Router();
const pathName = "/posts";
const secretKey = process.env.SECRET_KEY;

// 글쓰기
const writePost = (req, res, next) => {
  const { title, content, selectOption, userId } = req.body;

  try {
    const getToken = req.get("Authorization");
    const token = getToken.split(" ")[1];
    const verified = jwt.verify(token, secretKey);
    const email = verified?.email;
    const date = new Date();
    const formattedDate = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const getUserQuery = `SELECT * FROM User where email =?`;

    connection.query(getUserQuery, email, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      const postQuery = `INSERT INTO Post (title, content, createdPost, selectOption, userId) VALUES ('${title}','${content}', '${formattedDate}', '${selectOption}', '${result[0].id}')`;

      connection.query(postQuery, (err, result) => {
        if (err) {
          return res.status(500).json({ Error: err.message });
        }

        res.status(200).json({ message: "success" });
        console.log(result);
      });
    });
  } catch (error) {
    next(error);
  }
};

// 전체 글 가져오기
const getPost = (req, res, next) => {
  const { page } = req.query;

  const getPostQuery = `SELECT u.id, u.name, u.loginId,
  p.id as postId, p.title, p.content, p.createdPost, p.selectOption, p.view
  From User AS u
  Join Post AS p
  on u.id  = p.userId
  WHERE selectOption = ?
  ORDER BY createdPost ASC`;

  try {
    connection.query(getPostQuery, page, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      res.status(200).json({ postList: result });
    });
  } catch (error) {
    next(error);
  }
};

// 조회수 업데이트
const updateView = (req, res, next) => {
  const { postId } = req.body;
  const updateViewQuery = `UPDATE Post set view = view + 1 WHERE id = ${postId}`;

  try {
    connection.query(updateViewQuery, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      res.status(200).json({ success: "success" });
    });
  } catch (error) {
    next(error);
  }
};

// 핫 조회수 글 가져오기
const getTop10 = (req, res, next) => {
  const { page } = req.query;

  const getPost = `SELECT u.id, u.name, u.loginId,
  p.id as postId, p.title, p.content, p.createdPost, p.selectOption, p.view
  From User AS u
  Join Post AS p
  on u.id  = p.userId
  WHERE selectOption = ?
  ORDER BY view DESC
  LIMIT 10;
  `;

  try {
    connection.query(getPost, page, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      res.status(200).json({ postList: result });
    });
  } catch (error) {
    next(error);
  }
};

// 상세 정보


router.post("/writePost", writePost);
router.get("/getPost", getPost);
router.patch("/updateView", updateView);
router.get("/getTop10", getTop10);

export default {
  router,
  pathName,
};
