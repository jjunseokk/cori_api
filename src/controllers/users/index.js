import { Router, query } from "express";
import { connection } from "../../db/mysql.js";
import bcrypt, { hash } from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import multer from "multer";
import AWS from "aws-sdk";
import multerS3 from "multer-s3";
import path from "path";
import sharp from "sharp";

dotenv.config();

const router = Router();
const pathName = "/users";
const secretKey = process.env.SECRET_KEY;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  region: process.env.AWS_REGION,
});

// 확장자 검사 목록
const allowedExtensions = [".png", ".jpg", ".jpeg", ".bmp", ".gif"];

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
    cb(null, `profileImage/${fileName}.webp`);
  },
});

// s3 파일 업로드 객체 생성
const upload = multer({
  storage, // 파일 스토리지 설정
  limits: { fileSize: 5 * 1024 * 1024 }, // 파일 크기 제한
  defaultValue: { path: "", mimetype: "" }, // 기본 값
});

// 유저 정보 주기
const getProfile = (req, res, next) => {
  try {
    const getToken = req.get("Authorization");
    const token = getToken.split(" ")[1];
    const verified = jwt.verify(token, secretKey);
    const email = verified?.email;
    const getQuery = `SELECT id, email, name, profileImg, position, explanation FROM User WHERE email = ?;`;

    connection.query(getQuery, email, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      res.status(200).json({ User: result });
    });
  } catch {}
};

// 프로필 업데이트
const updateProfile = (req, res, next) => {
  try {

    const { name, position, explanation } = req.body;
    const profileImage = req.file.location;

    const getToken = req.get("Authorization");
    const token = getToken.split(" ")[1];
    const verified = jwt.verify(token, secretKey);
    const email = verified?.email;

    let updateProfileQuery = `UPDATE User SET name = '${name}', position = '${position}', explanation ='${explanation}'`;

    if (req.file) {
      updateProfileQuery += `, profileImg ='${profileImage}'`;
    }

    updateProfileQuery += ` WHERE email = ?`;

    connection.query(updateProfileQuery, email, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      if (name === "") {
        res.status(400).json({
          message: "이름은 필수 입력입니다.",
          name: false,
          statusCode: 400,
        });
      } else if (position === "") {
        res.status(400).json({
          message: "대표포지션은 필수 입력입니다.",
          position: false,
          statusCode: 400,
        });
      } else {
        res.status(200).json({ profile: "success" });
      }
    });
  } catch (err) {
    return res.status(500).json({ Error: err.message });
  }
};

// 회원가입
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
          return res.status(500).json({ Error: err.message });
        }

        if (Array.isArray(result) && result.length > 0) {
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
              return res.status(500).json({ Error: err.message });
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

// 로그인
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const token = jwt.sign({ email: email }, secretKey, { expiresIn: "7d" });

    const getQuery = `SELECT * FROM User WHERE email = ?`;

    connection.query(getQuery, email, (error, result) => {
      if (error) {
        return res.status(500).json({ Error: err.message });
      }
      bcrypt.compare(password, result[0]?.password, (err, same) => {
        if (err) {
          return res
            .status(500)
            .json({ Error: "비밀번호 해싱 중 오류가 발생했습니다." });
        }
        if (
          result == "" ||
          result[0].password === undefined ||
          same === false
        ) {
          res.json({
            message: "이메일과 비밀번호를 확인해주세요.",
            status: false,
            statusCode: 400,
          });
        } else {
          if (same === true) {
            res.json({
              user: {
                name: result[0].name,
                profileImg: result[0].profileImg,
                explanation: result[0].explanation,
                position: result[0].position,
                token: token,
              },
            });
          }
        }
      });
    });
  } catch (err) {
    next(err);
  }
};

router.get("/getProfile", getProfile);
router.post("/updateProfile", upload.single("image"), updateProfile);
router.post("/", createUser);
router.post("/login", loginUser);

export default {
  router,
  pathName,
};
