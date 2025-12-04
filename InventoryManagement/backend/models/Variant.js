import mongoose from 'mongoose';
const variantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, unique: true, sparse: true },
  values: [{ 
    name: { type: String, required: true },
    code: { type: String },
    sortOrder: { type: Number, default: 0 }
  }],
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  metadata: {
    color: { type: String, default: '' },
    icon: { type: String, default: '' }
  }
}, { timestamps: true });
export default mongoose.model('Variant', variantSchema);

