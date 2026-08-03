const express = require("express");
const app = express();
const fs = require("fs");
const multer = require("multer");
const { createWorker } = require("tesseract.js");

let worker;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./uploads");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage: storage }).single("avatar");

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index", { text: null, error: null });
});

app.post("/upload", (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.render("index", { text: null, error: err.message });
    }
    if (!req.file) {
      return res.render("index", {
        text: null,
        error: "কোনো ফাইল আপলোড করা হয়নি",
      });
    }

    try {
      const {
        data: { text },
      } = await worker.recognize(`./uploads/${req.file.filename}`);

      res.render("index", { text, error: null });
    } catch (error) {
      console.log(error);
      res.render("index", { text: null, error: "OCR করতে সমস্যা হয়েছে" });
    }
  });
});

const PORT = process.env.PORT || 5000;

(async () => {
  worker = await createWorker("eng+ben");

  app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
})();
