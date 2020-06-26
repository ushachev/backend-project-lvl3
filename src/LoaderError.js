export default class extends Error {
  constructor(message, source) {
    super(message);

    this.name = this.constructor.name;
    this.source = source;
  }
}
