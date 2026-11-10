// Populate storage choices/prices for imported Qauraa products.
// Run with mongosh while connected to the erd_algwal database.
// This script creates a backup collection before writing any product updates.

if (db.getName() !== 'erd_algwal') {
  throw new Error('Wrong database: expected erd_algwal, got ' + db.getName());
}

const products = db.getCollection('products');
const sourceFilter = { sourceStore: 'qauraa', deleted: { $ne: true } };
const sourceProducts = products.find(sourceFilter).toArray();

function westernDigits(value) {
  return String(value)
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function parseCapacity(name) {
  const normalized = westernDigits(name);
  const match = /(\d+(?:\.\d+)?)\s*(TB|GB|تيرابايت|تيرا(?:بايت)?|جيجابايت|جيجا(?:بايت)?)/iu.exec(normalized);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = /^(?:TB|تيرا)/iu.test(match[2]) ? 'TB' : 'GB';

  return {
    label: String(amount) + unit,
    rank: amount * (unit === 'TB' ? 1024 : 1)
  };
}

function baseName(name) {
  const normalized = westernDigits(name);
  const match = /(\d+(?:\.\d+)?)\s*(TB|GB|تيرابايت|تيرا(?:بايت)?|جيجابايت|جيجا(?:بايت)?)/iu.exec(normalized);
  if (!match || match.index === undefined) return null;

  return (normalized.slice(0, match.index) + ' ' + normalized.slice(match.index + match[0].length))
    .replace(/\s+/g, ' ')
    .replace(/\s*[-–—]\s*$/u, '')
    .trim();
}

const groups = new Map();
for (const product of sourceProducts) {
  if (typeof product.name !== 'string' || typeof product.price !== 'number' || !Number.isFinite(product.price) || product.price <= 0) {
    continue;
  }

  const capacity = parseCapacity(product.name);
  const normalizedName = baseName(product.name);
  if (!capacity || !normalizedName) continue;

  const categoryKey = String(product.categoryId || product.category || '');
  const key = categoryKey + '::' + normalizedName.toLocaleLowerCase();
  const group = groups.get(key) || { baseName: normalizedName, records: [] };
  group.records.push({ product, capacity });
  groups.set(key, group);
}

const updates = [];
const report = [];
for (const [key, group] of groups) {
  const prices = {};
  let conflict = false;

  for (const entry of group.records) {
    const previous = prices[entry.capacity.label];
    if (typeof previous === 'number' && previous !== entry.product.price) {
      conflict = true;
      break;
    }
    prices[entry.capacity.label] = entry.product.price;
  }

  const storageOptions = Object.keys(prices).sort((a, b) => {
    const rank = (value) => {
      const parsed = parseCapacity(value);
      return parsed ? parsed.rank : Number.MAX_SAFE_INTEGER;
    };
    return rank(a) - rank(b);
  });

  if (conflict || storageOptions.length < 2) {
    if (conflict) {
      report.push({ skipped: group.baseName, reason: 'Conflicting prices for the same storage size' });
    }
    continue;
  }

  for (const entry of group.records) {
    updates.push({
      updateOne: {
        filter: { _id: entry.product._id },
        update: {
          $set: {
            storageOptions,
            storagePrices: prices,
            updatedAt: new Date()
          }
        }
      }
    });
  }

  report.push({
    product: group.baseName,
    storageOptions,
    storagePrices: prices,
    databaseRecords: group.records.length
  });
}

print('===== QAURAA STORAGE MIGRATION PREVIEW =====');
printjson({
  database: db.getName(),
  activeQauraaProducts: sourceProducts.length,
  matchedVariantGroups: report.filter((item) => !item.skipped).length,
  recordsToUpdate: updates.length,
  groups: report
});

if (!updates.length) {
  print('No multi-size product groups found. No database changes made.');
} else {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const backupName = 'products_backup_qauraa_storage_' + timestamp;

  if (db.getCollectionNames().includes(backupName)) {
    throw new Error('Backup collection already exists: ' + backupName);
  }

  products.aggregate([
    { $match: sourceFilter },
    { $out: backupName }
  ]).toArray();

  const result = products.bulkWrite(updates, { ordered: false });
  print('===== QAURAA STORAGE MIGRATION APPLIED =====');
  printjson({
    backupCollection: backupName,
    matchedCount: result.matchedCount,
    modifiedCount: result.modifiedCount,
    groups: report.filter((item) => !item.skipped).length
  });
}
