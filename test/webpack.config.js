const path = require("path");
const { DelayForkTsOutputPlugin } = require("../dist");
const FriendlyError = require("friendly-errors-webpack-plugin");
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin");

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "./index.ts"),
  devServer: {
    quiet: true,
  },
  module: {
    strictExportPresence: true,
    rules: [
      {
        test: /\.tsx?$/,
        loader: "ts-loader",
        exclude: /node_modules/,
        options: {
          configFile: path.resolve(__dirname, "./tsconfig.json"),
          transpileOnly: true,
        },
      },
    ],
  },
  plugins: [
    new FriendlyError(),
    new ForkTsCheckerWebpackPlugin({
      tsconfig: path.resolve(__dirname, "./tsconfig.json"),
    }),
    new DelayForkTsOutputPlugin(),
  ],
};
