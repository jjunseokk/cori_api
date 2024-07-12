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
import { smtpTransport } from "../../util/email.js";

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
    console.log(verified);
    const loginId = verified?.loginId;
    const getQuery = `SELECT id, loginId, email, name, profileImg, position, explanation FROM User WHERE loginId = ?;`;

    connection.query(getQuery, loginId, (err, result) => {
      if (err) {
        return res.status(500).json({ Error: err.message });
      }
      res.status(200).json(result);
    });
  } catch (error) {
    return res.status(500).json({ Error: error.message });
  }
};

// 프로필 업데이트
const updateProfile = (req, res, next) => {
  try {
    const { name, position, explanation } = req.body;
    const profileImage = req.file ? req.file.location : null;

    const getToken = req.get("Authorization");
    const token = getToken.split(" ")[1];
    const verified = jwt.verify(token, secretKey);
    const loginId = verified?.loginId;

    let updateProfileQuery = `UPDATE User SET name = ?, position = ?, explanation = ?`;

    const queryParams = [name, position, explanation];

    if (profileImage) {
      updateProfileQuery += `, profileImg = ?`;
      queryParams.push(profileImage);
    }

    updateProfileQuery += ` WHERE loginId = ?`;
    queryParams.push(loginId);

    connection.query(updateProfileQuery, queryParams, (err, result) => {
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
  } catch (error) {
    return res.status(500).json({ Error: error.message });
  }
};

// 회원가입
const createUser = (req, res, next) => {
  try {
    const { loginId, name, email, password } = req.body;

    bcrypt.hash(password, 10, (err, hashedPw) => {
      if (err) {
        return res
          .status(500)
          .json({ Error: "비밀번호 해싱 중 오류가 발생했습니다." });
      }

      const getQuery = `SELECT * FROM User WHERE loginId = ?`;
      connection.query(getQuery, loginId, (error, result) => {
        if (error) {
          return res.status(500).json({ Error: err.message });
        }

        if (Array.isArray(result) && result.length > 0) {
          return res.status(400).json({
            message: "이미 가입된 아이디입니다.",
          });
        }

        const insertQuery = `INSERT INTO User (name, email, password, loginId) VALUES (?, ?, ?, ?)`;
        connection.query(
          insertQuery,
          [name, email, hashedPw, loginId],
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
    res.status(500).json({ message: error.message });
  }
};

// 이메일 인증
const emailCertification = (req, res, next) => {
  try {
    const generateRandom = function (min, max) {
      const ranNum = Math.floor(Math.random() * (max - min + 1)) + min;
      return ranNum;
    };

    const number = generateRandom(111111, 999999);

    const { email } = req.body;

    const mailOptions = {
      from: "oask12@naver.com",
      to: email,
      subject: "코리 회원가입 인증 메일입니다.",
      html: `
      <h1>인증번호를 입력해주세요. \n\n\n\n\n\n</h1>
      <div style="border : 1px solid #82B7F6; width : 300px; height : 150px; text-align : center;">
          <p style="color : black">코리 회원 가입을 위해 인증번호를 입력해주세요.</p>
          <p>인증번호 : <span style="color :#82B7F6; font-weight : border;">${number}</span></p>
      </div>
      `,
    };

    const getQuery = `SELECT * FROM User WHERE email = ?`;
    connection.query(getQuery, email, (error, result) => {
      if (error) {
        return res.status(500).json({ Error: err.message });
      }

      if (Array.isArray(result) && result.length > 0) {
        return res.status(400).json({
          message: "이미 가입된 이메일입니다.",
        });
      }

      smtpTransport.sendMail(mailOptions, (err, response) => {
        console.log("response", response);

        if (err) {
          res.status(400).json({ message: "메일 전송에 실패하였습니다." });
          smtpTransport.close();
          return;
        } else {
          res
            .status(200)
            .json({ message: "메일 전송에 성공하였습니다.", authNum: number });
          smtpTransport.close();
          return;
        }
      });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 로그인
const loginUser = (req, res, next) => {
  try {
    const { loginId, password } = req.body;
    const token = jwt.sign({ loginId: loginId }, secretKey, {
      expiresIn: "7d",
    });

    const getQuery = `SELECT * FROM User WHERE loginId = ?`;

    connection.query(getQuery, loginId, (error, result) => {
      if (error) {
        return res.status(500).json({ Error: err.message });
      }
      if (result.length > 0) {
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
            res.status(400).json({
              message: "아이디와 비밀번호를 확인해주세요.",
            });
          } else {
            if (same === true) {
              res.json({
                token: token,
              });
            }
          }
        });
      } else {
        res.status(400).json({ message: "아이디가 존재하지 않습니다." });
      }
    });
  } catch (err) {
    res.status(500).json({ message: error.message });
  }
};

// 아이디 찾기
const findId = (req, res, next) => {
  try {
    console.log(req.body);
  } catch (error) {
    next(err);
  }
};

router.get("/getProfile", getProfile);
router.post("/updateProfile", upload.single("image"), updateProfile);
router.post("/", createUser);
router.post("/login", loginUser);
router.post("/emailCertification", emailCertification);
router.post("/findId", findId);

export default {
  router,
  pathName,
};
