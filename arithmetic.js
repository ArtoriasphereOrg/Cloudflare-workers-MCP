export function evaluateArithmetic(expr) {
  if (expr.length === 0) throw new Error("expression is empty");
  if (expr.length > 200) throw new Error("expression is too long");
  let pos = 0;
  const peek = () => expr[pos];
  const skipSpace = () => {
    while (pos < expr.length && /\s/.test(expr[pos])) pos++;
  };
  function parseExpression() {
    skipSpace();
    let value = parseTerm();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "+" || op === "-") {
        pos++;
        const rhs = parseTerm();
        value = op === "+" ? value + rhs : value - rhs;
      } else break;
    }
    return value;
  }
  function parseTerm() {
    skipSpace();
    let value = parseFactor();
    for (;;) {
      skipSpace();
      const op = peek();
      if (op === "*" || op === "/") {
        pos++;
        const rhs = parseFactor();
        if (op === "/") {
          if (rhs === 0) throw new Error("division by zero");
          value = value / rhs;
        } else {
          value = value * rhs;
        }
      } else break;
    }
    return value;
  }
  function parseFactor() {
    skipSpace();
    if (peek() === "+") {
      pos++;
      return parseFactor();
    }
    if (peek() === "-") {
      pos++;
      return -parseFactor();
    }
    if (peek() === "(") {
      pos++;
      const value = parseExpression();
      skipSpace();
      if (peek() !== ")") throw new Error("expected closing parenthesis");
      pos++;
      return value;
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    if (pos === start) {
      throw new Error(`unexpected character '${peek() ?? "end of input"}' at position ${pos}`);
    }
    const numStr = expr.slice(start, pos);
    const num = Number(numStr);
    if (Number.isNaN(num)) throw new Error(`invalid number '${numStr}'`);
    return num;
  }
  const result = parseExpression();
  skipSpace();
  if (pos !== expr.length) {
    throw new Error(`unexpected character '${peek()}' at position ${pos}`);
  }
  if (!Number.isFinite(result)) throw new Error("result is not a finite number");
  return result;
}
