import { Router } from "express";
import { connection } from "../../db/mysql.js";
import multer from "multer";
import multerS3 from "multer-s3";
import AWS from "aws-sdk";
import path from "path";
import bcrypt, { hash } from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import moment from "moment";

dotenv.config();

const router = Router();
const pathName = "/posts";
const secretKey = process.env.SECRET_KEY;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});
// 확장자 검사 목록
const allowedExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"];

const storage = multerS3({
  s3, // AWS S3 연결
  acl: "public-read", // S3 Bucket의 객체에 대한 읽기 권한
  bucket: process.env.BUCKET_NAME, // S3 Bucket의 이름
  contentType: multerS3.AUTO_CONTENT_TYPE, // 파일 MIME 타입 자동 지정
  key: (req, file, cb) => {
    // 확장자 검사
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(extension)) {
      return cb(new Error("확장자 에러"));
    }

    const fileName = file.originalname.split(".")[0];
    // // 파일 이름 생성 및 반환
    cb(null, `thumbnailImage/${fileName}.webp`);
  },
});

// s3 파일 업로드 객체 생성
const upload = multer({
  storage, // 파일 스토리지 설정
  limits: { fileSize: 5 * 1024 * 1024 }, // 파일 크기 제한
  defaultValue: { path: "", mimetype: "" }, // 기본 값
});

// 글쓰기
const writePost = (req, res, next) => {
  const { title, content, selectOption, userId } = req.body;
  const thumbnailImage = req.file ? req.file.location : null;

  try {
    const getToken = req.get("Authorization");
    const token = getToken.split(" ")[1];
    const verified = jwt.verify(token, secretKey);
    const loginId = verified?.loginId;
    const date = new Date();
    const formattedDate = moment(date).format("YYYY-MM-DD HH:mm:ss");
    const getUserQuery = `SELECT * FROM User where loginId =?`;

    connection.query(getUserQuery, loginId, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }

      let postQuery = `INSERT INTO Post (title, content, createdPost, selectOption, userId, thumbnail) VALUES ('${title}','${content}', '${formattedDate}', '${selectOption}', '${result[0].id}', 'https://coribucket.s3.ap-northeast-2.amazonaws.com/thumbnailImage/postDefualt.webp')`;

      if (thumbnailImage) {
        postQuery = `INSERT INTO Post (title, content, createdPost, selectOption, userId, thumbnail) VALUES ('${title}','${content}', '${formattedDate}', '${selectOption}', '${result[0].id}', '${thumbnailImage}')`;
      }

      console.log(postQuery);

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
  p.id as postId, p.title, p.content, p.createdPost, p.selectOption, p.view, p.thumbnail
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
  p.id as postId, p.title, p.content, p.createdPost, p.selectOption, p.view, p.thumbnail
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
const getDetailPost = (req, res, next) => {
  const { id } = req.query;

  try {
    const getDetailQuery = `SELECT  p.id, p.title, p.content, p.createdPost, p.view, p.thumbnail, 
    u.loginId, u.profileImg
    From Post AS p
    Join User AS u
    on p.userId = u.id
    WHERE p.id = ?`;

    connection.query(getDetailQuery, id, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }

      res.status(200).json({ detailPost: result });
    });
  } catch (error) {}
};

router.post("/writePost", upload.single("thumbnail"), writePost);
router.get("/getPost", getPost);
router.patch("/updateView", updateView);
router.get("/getTop10", getTop10);
router.get("/getDetail", getDetailPost);

export default {
  router,
  pathName,
};
