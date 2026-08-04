const express = require("express");
const app = express();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { createWorker } = require("tesseract.js");

let worker;
let workerReady = false;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit, বড় ফাইল হলে OCR স্লো হয়
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("শুধুমাত্র image ফাইল আপলোড করুন"));
    }
    cb(null, true);
  },
}).single("avatar");

app.set("view engine", "ejs");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("index", { text: null, error: null });
});

// নতুন: AJAX endpoint, JSON রিটার্ন করে — page reload নেই তাই fast মনে হয়
app.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: "কোনো ফাইল আপলোড করা হয়নি" });
    }
    if (!workerReady) {
      cleanupFile(req.file.path);
      return res
        .status(503)
        .json({ error: "OCR engine এখনো লোড হচ্ছে, একটু পর আবার চেষ্টা করুন" });
    }

    const filePath = req.file.path;

    try {
      const {
        data: { text },
      } = await worker.recognize(filePath);

      cleanupFile(filePath); // ডিস্কে ফাইল জমতে না দেওয়ার জন্য
      res.json({ text, error: null });
    } catch (error) {
      console.log(error);
      cleanupFile(filePath);
      res.status(500).json({ error: "OCR করতে সমস্যা হয়েছে" });
    }
  });
});

function cleanupFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) console.log("File delete error:", err.message);
  });
}

const PORT = process.env.PORT || 5000;

(async () => {
  console.time("worker-init");
  worker = await createWorker("eng+ben");
  workerReady = true;
  console.timeEnd("worker-init");

  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
})();
