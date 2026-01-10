module.exports = (api) => {
    api.cache.using(() => true)
    return {
        presets: [['@babel/preset-react', { runtime: 'automatic' }], '@babel/preset-typescript'],
        plugins: [['babel-plugin-react-compiler', {}]],
    }
}
