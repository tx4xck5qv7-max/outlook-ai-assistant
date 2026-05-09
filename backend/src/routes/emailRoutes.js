const express = require("express");

const router = express.Router();

const {
  analyzeEmail,
  previewPrivacy
} = require("../controllers/emailController");

router.post(
  "/privacy-preview",
  previewPrivacy
);

router.post(
  "/analyze",
  analyzeEmail
);

module.exports = router;
