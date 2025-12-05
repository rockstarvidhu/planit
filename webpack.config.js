const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack'); // Added this
const dotenv = require('dotenv');   // Added this

module.exports = () => {
  // Load env variables
  const env = dotenv.config().parsed || {};

  // Convert to format required by DefinePlugin
  const envKeys = Object.keys(env).reduce((prev, next) => {
    prev[`process.env.${next}`] = JSON.stringify(env[next]);
    return prev;
  }, {});

  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js',
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
          },
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.jsx'],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './public/index.html',
      }),
      // This makes process.env available in your code
      new webpack.DefinePlugin(envKeys),
      // Fallback in case .env is empty or fails, prevents "process is not defined"
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(process.env || {})
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'public'),
      },
      port: 3000,
      hot: true,
      open: true,
      historyApiFallback: true,
    },
    mode: 'development',
  };
};