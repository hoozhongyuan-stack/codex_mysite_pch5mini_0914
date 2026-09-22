export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/detail/index',
    'pages/form/index',
    'pages/account/index',
    'pages/login/index',
    'pages/custom/index',
    'pages/checkout/index',
    'pages/videos/index',
    'pages/salons/index',
    'pages/cart/index',
  ],
  window: {
    navigationBarTitleText: '',
    navigationBarBackgroundColor: '#fafbf7',
    navigationBarTextStyle: 'black',
    backgroundColor: '#fafbf7',
  },
  lazyCodeLoading: 'requiredComponents',
});
