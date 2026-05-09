const express = require("express");

const router = express.Router();

const {
  analyzeEmail
} = require("../controllers/emailController");

router.post(
  "/analyze",
  analyzeEmail
);

module.exports = router;