const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    title: {type: String},
    country: {type: String, default: 'ایران'},
    address: {type: String},
    receiver: {type: String},
    postalCode: {type: Number},
    phone: {type: Number},
    user: {type: mongoose.Schema.Types.ObjectId, ref: 'User'},
});
    
module.exports = mongoose.model('Address', addressSchema);