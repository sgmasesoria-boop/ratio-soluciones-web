type ReadEnv = (name: string) => string | undefined;

function required(get: ReadEnv, name: string, max: number) {
  const value = (get(name) || '').trim();
  if (!value || value.length > max || /[\r\n\x00-\x1f]/.test(value)) {
    throw new Error('CONTRACT_ISSUER_NOT_CONFIGURED');
  }
  return value;
}

// No fallback identity: even draft PDFs must use explicitly configured details.
export function contractIssuer(get: ReadEnv) {
  return {
    name: required(get, 'RATIO_CONTRACT_ISSUER_NAME', 200),
    identifier: required(get, 'RATIO_CONTRACT_ISSUER_IDENTIFIER', 40),
    address: required(get, 'RATIO_CONTRACT_ISSUER_ADDRESS', 400),
  };
}

export function contractReplyTo(get: ReadEnv) {
  const value = required(get, 'RATIO_CONTRACT_REPLY_TO', 254);
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)) {
    throw new Error('CONTRACT_ISSUER_NOT_CONFIGURED');
  }
  return value;
}
