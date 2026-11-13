'use strict';

/**
 * TÁCH / KIỂM TRA CÂU SQL (deployment scripts).
 *
 * Vì sao cần: `prisma.$executeRawUnsafe()` chạy được NHIỀU câu trong một lần gọi
 * trên PostgreSQL (simple query protocol), nhưng khi Prisma gói chúng trong một
 * transaction ngầm thì mọi câu nằm chung một transaction. Điều đó phá vỡ hai giả
 * định của các script delta:
 *
 *  1. `ALTER TYPE ... ADD VALUE` không được dùng giá trị mới trong CÙNG
 *     transaction (PostgreSQL `55P04 unsafe use of new value of enum type`).
 *  2. Nếu câu thứ 3 lỗi, câu 1–2 đã commit ở chế độ "mỗi câu một transaction"
 *     nhưng KHÔNG commit khi gói chung — trạng thái sau lỗi khác nhau, nên không
 *     thể khẳng định "chạy lại là an toàn".
 *
 * Vì vậy mỗi entry của `STATEMENTS` phải là ĐÚNG MỘT câu, và script gọi
 * `assertSingleStatement()` trước mỗi lần `$executeRawUnsafe()` để không bao giờ
 * lặp lại lỗi cũ một cách âm thầm.
 */

/**
 * Tách chuỗi SQL thành từng câu, tôn trọng:
 * - chuỗi `'...'` (escape bằng `''`),
 * - identifier `"..."` (escape bằng `""`),
 * - dollar-quoted block `$$ ... $$` / `$tag$ ... $tag$` (thân DO block),
 * - comment dòng `--` và comment khối `/* ... *\/`.
 *
 * @param {string} sql
 * @returns {string[]} các câu đã trim, bỏ qua phần chỉ có comment/khoảng trắng
 */
const splitSqlStatements = (sql) => {
  const input = String(sql ?? '');
  const statements = [];
  let current = '';
  let index = 0;
  let inSingle = false;
  let inDouble = false;
  let dollarTag = null;

  while (index < input.length) {
    const char = input[index];
    const next = input[index + 1];

    if (dollarTag) {
      if (char === '$' && input.startsWith(dollarTag, index)) {
        current += dollarTag;
        index += dollarTag.length;
        dollarTag = null;
        continue;
      }
      current += char;
      index += 1;
      continue;
    }

    if (inSingle) {
      current += char;
      if (char === "'") {
        if (next === "'") {
          current += next;
          index += 2;
          continue;
        }
        inSingle = false;
      }
      index += 1;
      continue;
    }

    if (inDouble) {
      current += char;
      if (char === '"') {
        if (next === '"') {
          current += next;
          index += 2;
          continue;
        }
        inDouble = false;
      }
      index += 1;
      continue;
    }

    if (char === '-' && next === '-') {
      const newline = input.indexOf('\n', index);
      const stop = newline === -1 ? input.length : newline;
      current += input.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === '/' && next === '*') {
      const end = input.indexOf('*/', index + 2);
      const stop = end === -1 ? input.length : end + 2;
      current += input.slice(index, stop);
      index = stop;
      continue;
    }

    if (char === "'") {
      inSingle = true;
      current += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      current += char;
      index += 1;
      continue;
    }

    if (char === '$') {
      const match = /^\$[A-Za-z_0-9]*\$/.exec(input.slice(index));
      if (match) {
        dollarTag = match[0];
        current += dollarTag;
        index += dollarTag.length;
        continue;
      }
    }

    if (char === ';') {
      statements.push(current);
      current = '';
      index += 1;
      continue;
    }

    current += char;
    index += 1;
  }

  statements.push(current);

  return statements
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim() !== '');
};

/**
 * Đếm số câu SQL "thật" trong một chuỗi (bỏ comment).
 * @param {string} sql
 * @returns {number}
 */
const countSqlStatements = (sql) => splitSqlStatements(sql).length;

/**
 * Ném lỗi NGAY (trước khi chạy) nếu một entry không phải đúng một câu.
 * @param {string} sql
 * @param {string} label
 */
const assertSingleStatement = (sql, label) => {
  const count = countSqlStatements(sql);
  if (count !== 1) {
    throw new Error(
      `Entry "${label}" chứa ${count} câu SQL. Mỗi lần $executeRawUnsafe() chỉ được chạy ĐÚNG MỘT câu ` +
        '(xem scripts/lib/sql-statements.js để biết lý do).',
    );
  }
};

module.exports = { splitSqlStatements, countSqlStatements, assertSingleStatement };
