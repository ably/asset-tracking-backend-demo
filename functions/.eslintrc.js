module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    'airbnb-base',
  ],
  rules: {
    'max-len': ['off'],
    'no-use-before-define': ['off'],
    'max-classes-per-file': ['off'],
  },
};
