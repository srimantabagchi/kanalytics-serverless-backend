const express = require("express");
const AWS = require("aws-sdk");
const router = express.Router();
const multer = require("multer");
const multerS3 = require("multer-s3");
const path = require("path");
const mime = require("mime");
const fs = require("fs");
const stream = require("stream");
const auth = require("../../middleware/auth");
const { check, validationResult } = require("express-validator");

const Profile = require("../../models/Profile");
const User = require("../../models/User");

const credentials = new AWS.SharedIniFileCredentials({ profile: "saml" });

AWS.config.credentials = credentials;

AWS.config.getCredentials(function(err) {
  if (err) console.log(err.stack);
  // credentials not loaded
  else {
    console.log("Access key:", AWS.config.credentials.accessKeyId);
    console.log("Secret access key:", AWS.config.credentials.secretAccessKey);
  }
});

AWS.config.update({
  region: "us-east-1"
});

const s3 = new AWS.S3();

const s3BucketName = "test-bucket-srimanta";

const upload = multer({
  storage: multerS3({
    s3: s3,
    bucket: s3BucketName,
    key: function(req, file, cb) {
      console.log("The file is : " + JSON.stringify(file));
      cb(null, file.originalname); //use Date.now() for unique file keys
    }
  })
});

// @route    GET api/profile/me
// @desc     Get current users profile
// @access   Private
router.get("/me", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({
      user: req.user.id
    }).populate("user", ["name"]);

    if (!profile) {
      return res.status(400).json({ msg: "There is no profile for this user" });
    }

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    POST api/profile
// @desc     Create or update user profile
// @access   Private
router.post(
  "/",
  [
    auth,
    [
      check("company", "Company is required")
        .not()
        .isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { company } = req.body;

    // Build profile object
    const profileFields = {};
    profileFields.user = req.user.id;
    if (company) profileFields.company = company;

    try {
      let profile = await Profile.findOne({ user: req.user.id });

      if (profile) {
        // Update
        profile = await Profile.findOneAndUpdate(
          { user: req.user.id },
          { $set: profileFields },
          { new: true }
        );

        return res.json(profile);
      }

      // Create
      profile = new Profile(profileFields);

      await profile.save();
      res.json(profile);
    } catch (err) {
      console.error(err.message);
      res.status(500).send("Server Error");
    }
  }
);

// @route    POST api/profile/files
// @desc     Add profile files
// @access   Private
router.post("/files", [auth, upload.single("file")], async (req, res) => {
  // TODO Check validation
  console.log("req.file " + JSON.stringify(req.file));
  const errors = validationResult(req);
  console.log("errors.array()" + JSON.stringify(errors.array()));
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    originalname,
    encoding,
    mimetype,
    size,
    bucket,
    key,
    location
  } = req.file;

  const newFile = {
    originalname,
    encoding,
    mimetype,
    size,
    bucket,
    key,
    location
  };

  console.log("The req object is : " + JSON.stringify(req.body));
  try {
    let profile = await Profile.findOne({ user: req.user.id });

    console.log("Profile is : " + profile);

    if (profile) {
      profile.files.unshift(newFile);

      await profile.save();

      return res.json(profile);
    } else {
      // Build profile object
      const profileFields = {};
      profileFields.user = req.user.id;

      // Create
      profile = new Profile(profileFields);
      profile.files.unshift(newFile);

      await profile.save();
      return res.json(profile);
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    DELETE api/profile/files/:file_id
// @desc     Delete file from profile
// @access   Private
router.delete("/files/:file_id", auth, async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.id });

    // Get remove index
    const removeIndex = profile.files
      .map(item => item.id)
      .indexOf(req.params.file_id);

    console.log("key is : " + profile.files[removeIndex].key);

    await s3
      .deleteObject({
        Bucket: s3BucketName,
        Key: profile.files[removeIndex].key
      })
      .promise();

    profile.files.splice(removeIndex, 1);

    await profile.save();

    res.json(profile);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

// @route    GET api/profile/files/:file_id
// @desc     Download file from profile
// @access   Private
router.get("/files/:file_id", auth, async (req, res) => {
  try {
    console.log("Calling download file");
    const profile = await Profile.findOne({ user: req.user.id });
    console.log("Calling profile file: " + profile);
    console.log("Calling req obj file: " + JSON.stringify(req.params));

    // console.log("Calling profile path: " + file);

    const something = profile.files.filter(
      item => item._id == req.params.file_id
    );

    console.log("Calling profile something: " + something);

    const key = profile.files
      .filter(item => item._id == req.params.file_id)
      .map(item => item.key)
      .toString();
    const fileName = profile.files
      .filter(item => item._id == req.params.file_id)
      .map(item => item.originalname)
      .toString();

    const mimetype = profile.files
      .filter(item => item._id == req.params.file_id)
      .map(item => item.mimetype)
      .toString();

    console.log("Calling profile key: " + key);
    let params = { Bucket: s3BucketName, Key: key };
    let filestream = s3.getObject(params).createReadStream();

    // const mimetype = mime.lookup(file);

    res.setHeader("Content-disposition", "attachment");
    res.setHeader("filename", fileName);
    res.setHeader("Content-type", mimetype);

    // const filestream = fs.createReadStream(file);
    filestream.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
