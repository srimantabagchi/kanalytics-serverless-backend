const mongoose = require("mongoose");

const ProfileSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "user"
  },
  files: [
    {
      originalname: {
        type: String,
        required: true
      },
      encoding: {
        type: String,
        required: true
      },
      mimetype: {
        type: String,
        required: true
      },
      size: {
        type: String,
        required: true
      },
      bucket: {
        type: String,
        required: true
      },
      key: {
        type: String,
        required: true
      },
      location: {
        type: String,
        required: true
      },
      createdDate: {
        type: Date,
        default: Date.now
      }
    }
  ]
});

module.exports = Profile = mongoose.model("profile", ProfileSchema);
