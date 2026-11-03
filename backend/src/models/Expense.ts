import { Schema, model, InferSchemaType, HydratedDocument } from 'mongoose';
import { EXPENSE_CATEGORIES, MILK_TYPES, EXPENSE_MAX } from '../utils/domain';

const expenseSchema = new Schema(
  {
    dairyId: { type: Schema.Types.ObjectId, ref: 'Dairy', required: true, index: true },
    // UTC midnight of the dairy's local calendar day, same convention as MilkEntry.
    spentOn: { type: Date, required: true },
    category: { type: String, enum: EXPENSE_CATEGORIES, required: true },
    // Which animal the cost belongs to. 'shared' covers costs that can't be
    // split per animal (labour, electricity), so profit stays honest.
    milkType: { type: String, enum: [...MILK_TYPES, 'shared'], required: true, default: 'shared' },
    amount: { type: Number, required: true, min: 0.01, max: EXPENSE_MAX },
    note: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true },
);

expenseSchema.index({ dairyId: 1, spentOn: -1 });

export type ExpenseDoc = HydratedDocument<InferSchemaType<typeof expenseSchema>>;
export const Expense = model('Expense', expenseSchema);
