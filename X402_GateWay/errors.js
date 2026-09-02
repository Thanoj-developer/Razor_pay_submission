class MandateValidationError extends Error {
  constructor(message, code = 'MANDATE_INVALID') {
    super(message);
    this.name = 'MandateValidationError';
    this.code = code;
  }
}

module.exports = {
  MandateValidationError
};
