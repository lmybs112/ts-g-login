(function () {
  function Product_Recommendation(config = {}) {
    // 解構參數並設置預設值
    const defaultConfig = {
      brand: "JERSCY",
      containerId: "infFitsFooter",
      customEdm: [],
      backgroundColor: "#fff", // 默認背景色為黑色
      title: "推薦您也可以這樣搭配", // 默認標題文字
      customPadding: null,
      arrowPosition: "center", // 默認箭頭位置
      autoplay: true, // 默認開啓輪播
      hide_discount: false, // 默認不隱藏折扣
      hide_size: false, // 默認不隱藏尺寸
      bid: {
        HV: "163",
        WV: "50",
        CC: "97.5_97.5",
        DataItem: "0100",
        Shoulder: "",
        UpChest: "",
        DnChest: "",
        Waist: "",
        Hip: "",
        Brand: "JERSCY",
        ClothID: "",
        Sizes: "",
        FitP: "0,0,0,0",
        Gender: "M",
        FMLpath: "FMLSep",
        BUS: "0",
        GVID: "",
        LGVID: "",
        MRID: "INF",
        ga_id: "x",
        Pattern_Prefer: "1",
      },
      breakpoints: {
        768: {
          slidesPerView: 3,
          slidesPerGroup: 3 * 2,
          spaceBetween: 24,
          grid: {
            rows: 2,
            fill: "row",
          },
        },
        0: {
          slidesPerView: 2,
          slidesPerGroup: 1,
          spaceBetween: 24,
          speed: 750,
          resistanceRatio: 0,
          grid: {
            rows: 3,
            fill: "row",
          },
        },
      },
    };
    const finalConfig = {
      ...defaultConfig,
      ...config,
      breakpoints: {
        ...defaultConfig.breakpoints,
        ...(config?.breakpoints || {}),
      },
    };

    // 解構出常用參數
    const {
      brand,
      containerId,
      customEdm,
      hide_discount,
      hide_size,
      bid,
      backgroundColor,
      title,
      autoplay,
      arrowPosition,
      customPadding,
    } = finalConfig;

    // 轉換斷點為排序後的陣列
    const sortedBreakpoints = Object.keys(finalConfig.breakpoints)
      .map(Number)
      .sort((a, b) => b - a) // 從大到小排序
      .reduce((acc, key) => {
        acc[key] = finalConfig.breakpoints[key];
        return acc;
      }, {});
    ////Global////
    var Brand = brand;
    // var link_included = ['inffits', 'localhost', 'personalizedpage', 'product']
    var skuContent = shopline_sku(); //plain_me_sku()
    var show_up_position_before = "#" + containerId;
    var test = "A";
    var GA4Key = "";

    // 移除全局模块注册代码

    function member_id_91APP() {
      let i;
      // 檢查 dataLayer 是否定義
      if (typeof dataLayer !== "undefined") {
        for (let i = 0; i < dataLayer.length; i++) {
          if (dataLayer[i].Action === "Product-Detail") {
            // 找到了符合條件的項目，執行後續動作
            console.log('找到了符合 "gtm.load" 的事件，執行後續動作');
            console.log("FOUND!!");
            if (dataLayer[i].Uid !== "") member_id = dataLayer[i].Uid;
            else member_id = "";

            // 進行其他操作（如果需要的話）
            break;
          } else member_id = "";
        }
      }
      return member_id;
    }
    function member_id_Shopline() {
      //Fake data
      let member_id = "";
      // let chklog1 = '"currentUser\\"';
      // let chklog2 = ':null';
      // if (!document.documentElement.innerHTML.includes(chklog1 + chklog2)) {
      //     member_id = document.documentElement.innerHTML.split('href="/users/')[1].split('",')[0].split('/edit"')[0];
      // }
      return member_id;
    }
    function member_id_plain_me() {
      let member_id;
      // 檢查 dataLayer 是否定義
      if (typeof dataLayer !== "undefined") {
        for (let i = 0; i < dataLayer.length; i++) {
          if (dataLayer[i].Action === "Product-Detail") {
            // 找到了符合條件的項目，執行後續動作
            console.log('找到了符合 "gtm.load" 的事件，執行後續動作');
            console.log("FOUND!!");
            if (dataLayer[i].Uid !== "") member_id = dataLayer[i].Uid;
            else member_id = "";

            // 進行其他操作（如果需要的話）
            break;
          } else member_id = "";
        }
      }
      return member_id;
    }
    function plain_me_sku() {
      var metaTag = document.querySelector('meta[property="og:sku"]');
      if (metaTag) {
        var skuContent = metaTag.getAttribute("content").split("-")[0];
        console.log(skuContent); // 輸出 "FRP99153"
      } else if (document.querySelector(".prodnoBox") !== null) {
        var skuContent = document
          .querySelector(".prodnoBox")
          .innerText.split(":")[1]
          .split("-")[0];
      } else {
        console.log("Meta tag not found");
      }
      return skuContent;
    }
    function app91_sku() {
      var skuContent = document.location.href
        .split("?")[0]
        .split("/SalePage/Index/")[1];

      return skuContent;
    }
    function shopline_sku() {
      //var data = document.documentElement.innerHTML
      //var skuContent = data.split('"sku":"')[1].split('"')[0].split(':')[0]
      //Fake data
      skuContent = "627b5ab044a027000fde0add";
      return skuContent;
    }

    ////Main////
    // if (link_included.some((link) => document.location.href.includes(link))) {
    //jQuery
    function ensureEmbeddedAdJQueryLoaded(callback) {
      if (typeof jQuery === "undefined") {
        var embeddedAdjQueryScript = document.createElement("script");
        embeddedAdjQueryScript.src =
          "https://ajax.googleapis.com/ajax/libs/jquery/3.6.0/jquery.min.js";
        embeddedAdjQueryScript.type = "text/javascript";
        embeddedAdjQueryScript.onload = function () {
          // console.log("jQuery 已成功載入");
          loadSwiperScript(); // 先載入 Swiper
          callback(); // 再執行嵌入腳本
        };
        embeddedAdjQueryScript.onerror = function () {
          console.error("載入 jQuery 時出錯");
        };
        document.head.appendChild(embeddedAdjQueryScript);
      } else {
        // console.log("jQuery 已經載入");
        loadSwiperScript(); // 先載入 Swiper
        callback(); // 再執行嵌入腳本
      }
    }

    //swiper
    function loadSwiperScript() {
      var swiperStylesheet = document.createElement("link");
      swiperStylesheet.rel = "stylesheet";
      swiperStylesheet.href =
        "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css";
      document.head.appendChild(swiperStylesheet);

      var SwiperScript = document.createElement("script");
      SwiperScript.src =
        "https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js";
      SwiperScript.onload = function () {
        // console.log("Swiper script loaded successfully");
      };
      SwiperScript.onerror = function () {
        console.error("Error loading Swiper script");
      };
      document.head.appendChild(SwiperScript);
    }
    //embedded script
    function loadEmbeddedScript($) {
      (function ($) {
        // 動態添加 Google 字體連結
        var googleFontLink = document.createElement("link");
        googleFontLink.rel = "preconnect";
        googleFontLink.href = "https://fonts.googleapis.com";
        document.head.appendChild(googleFontLink);

        var googleFontLink2 = document.createElement("link");
        googleFontLink2.rel = "preconnect";
        googleFontLink2.href = "https://fonts.gstatic.com";
        googleFontLink2.crossorigin = "anonymous";
        document.head.appendChild(googleFontLink2);

        var googleFontLink3 = document.createElement("link");
        googleFontLink3.rel = "stylesheet";
        googleFontLink3.href =
          "https://fonts.googleapis.com/css2?family=Chocolate+Classical+Sans&family=Figtree:ital,wght@0,300..900;1,300..900&family=Noto+Sans+TC:wght@100..900&display=swap";
        document.head.appendChild(googleFontLink3);

        // 動態添加 Bootstrap Bundle
        // var bootstrapScript = document.createElement('script')
        // bootstrapScript.src =
        //   'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
        // bootstrapScript.crossorigin = 'anonymous'
        // document.head.appendChild(bootstrapScript)

        // bootstrapScript.onload = function () {
        // 動態添加 Bootstrap scoped CSS
        // var bootstrapScopedStyle = document.createElement("style");
        // bootstrapScopedStyle.id = "embedded-ad-bootstrap-scoped";
        // document.head.appendChild(bootstrapScopedStyle);
        // 動態添加自定 CSS
        var customCSS = document.createElement("style");
        customCSS.type = "text/css";
        customCSS.innerHTML = `:root {
                        --inf-embedded-ad-font-9: 9px;
                        --inf-embedded-ad-font-8: 8px;
                        --inf-embedded-ad-font-12: 12px;
                        --inf-embedded-ad-font-13: 13px;
                        --inf-embedded-ad-font-14: 14px;
                        --inf-embedded-ad-font-15: 15px;
                        --inf-embedded-ad-font-16: 16px;
                        --inf-embedded-ad-font-18: 18px;
                        --inf-embedded-ad-font-21: 21px;
                        --inf-embedded-ad-font-custom: 15px;
                        --inf-embedded-ad-radius-8: 8px;
                        --inf-embedded-ad-dark-yellow: rgba(59, 59, 50, 1);
                        --inf-embedded-ad-dark-gray: #3B3B32;
                        --inf-embedded-ad-dark-red: #EB7454;
                        --inf-embedded-ad-light-gray: rgba(59, 59, 50, 0.30);
                        --swiper-wrapper-transition-timing-function: liner !important;
                        }
                        #${containerId} #recommendation-loading {
                          height: 131.71px;
                          display: flex;
                          align-items: center;
                          justify-content: center;
                          width: 100%;
                        }
                        @media (min-width: 480px) {
                          #${containerId} #recommendation-loading {
                            height: 169.14px;
                          }
                        }
                        #${containerId} #recommendation-loading .loading-text {
                          font-size: 14px;
                          display: inline-block;
                          letter-spacing: 2px;
                          color: black;
                          box-sizing: border-box;
                          animation: animloader 1s ease-in infinite alternate;
                        }

                        @keyframes animloader {
                          0% {
                            filter: blur(0px);
                            transform: skew(0deg);
                          }
                          100% {
                            filter: blur(3px);
                            transform: skew(-4deg);
                          }
                        }
                        #${containerId} .embeddedAdContainer {
                        padding: 0px;
                        margin: 0 auto;
                        width: 100%;
                        max-width: 100%;
                        display: none;
                        position: relative;
                        width:fit-content;
                        }
                        #${containerId} .embeddedAdContainer * {
                          margin: 0;
                          padding: 0;
                          box-sizing: border-box;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer {
                        // padding: 16px 18px;
                        }
                        }
                        
                        #${containerId} .swiper-next,
                        #${containerId} .swiper-prev,
                        #${containerId} .swiper-next-corr,
                        #${containerId} .swiper-prev-corr {
                        display: none;
                        cursor:pointer;
                        }
                        #${containerId} .swiper-next::after, 
                        #${containerId} .swiper-prev::after, 
                        #${containerId} .swiper-next-corr::after, 
                        #${containerId} .swiper-prev-corr::after {
                        content: "";
                        }
                        @media (min-width: 768px) {
                        #${containerId} .swiper-next,
                        #${containerId} .swiper-prev,
                        #${containerId} .swiper-next-corr,
                        #${containerId} .swiper-prev-corr {
                        display: block;
                        position: absolute;
                        top: 45%;
                        z-index: 99;
                        }
                        #${containerId} .swiper-next, 
                        #${containerId} .swiper-next-corr{
                        right: -28px;
                        }
                        #${containerId} .swiper-prev, 
                        #${containerId} .swiper-prev-corr{
                        left: -28px;
                        }
                        }
    
                      #${containerId} .title-navigation {
                        display: inline-flex;
                        align-items: center;
                        margin-left: auto;
                        column-gap: 8px;
                        }
                        
                        #${containerId} .title-nav-prev,
                        #${containerId} .title-nav-next {
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border-radius: 0;
                        background-color: transparent;
                        box-shadow: none;
                        }
                        
                        #${containerId} .title-nav-prev:hover,
                        #${containerId} .title-nav-next:hover {
                        opacity: 0.7;
                        }
                        
                        #${containerId} .title-nav-prev img,
                        #${containerId} .title-nav-next img {
                        width: 18px;
                        height: 18px;
                        }
    
                        @media (min-width: 768px) {
                          #${containerId} .title-nav-prev img,
                          #${containerId} .title-nav-next img {
                              width: 20px;
                              height: 20px;
                          }
                        }
    
                        #${containerId} .embeddedAdContainer a {
                        text-decoration: none !important;
                        color: inherit;
                        background: none;
                        border: none;
                        padding: 0;
                        margin: 0;
                        font-weight: 500;
                        font-style: normal;
                        display: inline;
                        }
                        #${containerId} .embeddedAdContainer a:hover,
                        #${containerId} .embeddedAdContainer a:visited,
                        #${containerId} .embeddedAdContainer a:link,
                        #${containerId} .embeddedAdContainer a:active {
                        text-decoration: none;
                        }
                        #${containerId} .embeddedAdContainer a:focus {
                        outline: none;
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdContainer__title {
                        //font-family: "Chocolate Classical Sans", "Figtree", sans-serif;
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        text-align: center;
                        font-style: normal;
                        font-weight: 500;
                        line-height: normal;
                        color: #000;
                        font-size: var(--inf-embedded-ad-font-16);
                        letter-spacing: 1.6px;
                        text-align:left;
                        margin:0;
                        padding:0;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdContainer__title {
                        margin-top: 0px;
                        }
                        }
                        
                        @media (min-width: 1025px) {
                        #${containerId} .embeddedAdContainer .embeddedAdContainer__title {
                        color: var(--inf-embedded-ad-dark-yellow), var(--inf-embedded-ad-dark-gray);
                              font-size: 22px;
                              letter-spacing: 22px;
                              letter-spacing: 0.84px;
                              font-weight: 500;
                              margin-top: 0px;
                          }
                        }
    
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem {
                        cursor: pointer;
                        display: -ms-flexbox;
                        display: flex;
                        -ms-flex-direction: column;
                        flex-direction: column;
                        width: 100%;
                        -ms-flex-pack: center;
                        justify-content: center;
                        -ms-flex-align: center;
                        align-items: center;
                        row-gap: 12px;
                        padding: 0;
                        // padding: 0 2px;
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img {
                        position: relative;
                        width: 100%;
                        border-radius: var(--inf-embedded-ad-radius-8);
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__img--tag {
                        position: absolute;
                        top: 4px;
                        left: 4px;
                        display: -ms-flexbox;
                        display: flex;
                        -ms-flex-pack: center;
                        justify-content: center;
                        -ms-flex-align: center;
                        align-items: center;
                        gap: 10px;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__img--tag {
                        top: 8px;
                        left: 8px;
                        }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__img--tag div {
                        z-index: 1;
                        padding: 3px 4px;
                        border-radius: 100px;
                        background: rgba(59, 59, 50, 0.14);
                        -webkit-backdrop-filter: blur(3.5px);
                          backdrop-filter: blur(3.5px);
                        -webkit-background-filter: blur(3.5px);
                        color: #F3F3EF;
                        text-align: center;
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        //font-family: "Chocolate Classical Sans", "Figtree", sans-serif;
                        font-size: var(--inf-embedded-ad-font-8);
                        line-height: 11px;
                        font-style: normal;
                        font-weight: 400;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__img--tag div {
                        padding: 5px 8px;
                        font-size: var(--inf-embedded-ad-font-14);
                        line-height: 17px;
                        }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__imgBox {
                        width: 100%;
                        /*padding-top: 100%;*/
                        position: relative;
                        overflow: hidden;
                        aspect-ratio: 1 / 1;
                        display:grid;
                        place-items:center;
                        border-radius: var(--inf-embedded-ad-radius-8);
                        will-change: transform;
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__sizeTag {
                          position:absolute;
                          // bottom:9.5px;
                          // right:9.5px;
                          bottom: 3%;
                          right: 3%;
                          border-radius: 40px;
                          background: rgba(255, 255, 255, 0.70);
                          backdrop-filter: blur(6px);
                          display: flex;
                          // padding: 7px 14px;
                          padding: 3% 15%;
                          justify-content: center;
                          align-items: center;
                          gap: 4px;
                          z-index:1;
                          color: rgba(0, 0, 0, 0.95);
                          font-family: Figtree;
                          font-size: 15px;
                          font-style: normal;
                          font-weight: 500;
                          line-height: 20px;
                          letter-spacing: -0.12px;
                        }
                        @media (min-width: 768px) {
                          #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img .embeddedItem__sizeTag {
                            position:absolute;
                            bottom:12px;
                            right:12px;
                            border-radius: 40px;
                            background: rgba(255, 255, 255, 0.70);
                            backdrop-filter: blur(6px);display: flex;
                            padding: 14px 20px;
                            justify-content: center;
                            align-items: center;
                            gap: 4px;
                            z-index:1;
                            color: rgba(0, 0, 0, 0.95);
                            font-family: Figtree;
                            font-size: 17px;
                            font-style: normal;
                            font-weight: 500;
                            line-height: 22px;
                            letter-spacing: -0.136px;
                          }
                        }
    
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItem__img img {
                          position: absolute;
                          top: 0;
                          bottom:0;
                          left: 0;
                          margin:auto;
                          width: 100%;
                          /*height: 100%;*/
                          -o-object-fit: cover;
                          object-fit: cover;
                          will-change:transform;
                          border-radius: var(--inf-embedded-ad-radius-8);
                          -webkit-border-radius: var(--inf-embedded-ad-radius-8);
                          -moz-border-radius: var(--inf-embedded-ad-radius-8);
                          -ms-border-radius: var(--inf-embedded-ad-radius-8);
                          -o-border-radius: var(--inf-embedded-ad-radius-8);
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo {
                        // padding-top: 8px;
                        width: 100%;
                        display: -ms-flexbox;
                        display: flex;
                        -ms-flex-direction: column;
                        flex-direction: column;
                        width: 100%;
                        gap: 2px 0;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo {
                        // padding-top: 12px;
                        gap: 2px 0;
                        }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__title {
                        color: var(--inf-embedded-ad-dark-gray);
                        text-align: center;
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        font-size: var(--inf-embedded-ad-font-12);
                        font-style: normal;
                        font-weight: 500;
                        line-height: 18px;
                        letter-spacing: 0.26px;
                        overflow: hidden;
                        display: -webkit-box;
                        display: box;
                        -webkit-line-clamp: 1;
                        line-clamp: 1;
                        -webkit-box-orient: vertical;
                        box-orient: vertical;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__title {
                        // font-family: "Chocolate Classical Sans", "Figtree", sans-serif;
                        // font-size: var(--inf-embedded-ad-font-18);
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        font-size: var(--inf-embedded-ad-font-custom);
                        font-style: normal;
                        line-height: 23px;
                        /* 127.778% */
                        letter-spacing: 0.36px;
                        }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__price--original {
                        color: var(--inf-embedded-ad-dark-red);
                        text-align: center;
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        //font-family: "Figtree", sans-serif;
                        font-size: 12px;
                        font-style: normal;
                        font-weight: 500;
                        line-height: 17px;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__price--original {
                        color: var(--inf-embedded-ad-dark-red);
                        text-align: center;
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        //font-family: "Figtree", sans-serif;
                        // font-size: var(--inf-embedded-ad-font-18);
                        font-size: var(--inf-embedded-ad-font-custom);
                        font-style: normal;
                        font-weight: 500;
                        line-height: 23px;
                        }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content {
                        display: -ms-flexbox;
                        display: flex;
                        -ms-flex-pack: center;
                        justify-content: center;
                        -ms-flex-align: baseline;
                        align-items: baseline;
                        gap:2px;
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__discount {
                            color: #eb7454;
                            background: white;
                            border:1px solid #eb7454;
                            padding: 0 4px;
                            border-radius: 5px;
                            font-size: 12px;
                            opacity: 1;
                            transform:scale(0.8)
                            }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__sptext {
                                color: #333;
                                background: white;
                                padding: 0 4px;
                                border-radius: 5px;
                                font-size: 12px;
                                opacity: 1;
                                text-align:center;
                            }
                        
                        
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price {
                        margin-right: 8px;
                        color: var(--inf-embedded-ad-dark-red);
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        //font-family: "Figtree", sans-serif;
                        font-size: var(--inf-embedded-ad-font-12);
                        font-style: normal;
                        font-weight: 500;
                        line-height: 17px;
                        /* 141.667% */
                        }
                        @media (min-width: 768px) {
                        
                            // .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__discount {
                            //     transform:scale(1)
                            // }
                        
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price {
                            // font-size: var(--inf-embedded-ad-font-18);
                            font-size: var(--inf-embedded-ad-font-custom);
                            line-height: 23px;
                            /* 127.778% */
                            }
                        }
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price--original {
                        color: var(--inf-embedded-ad-light-gray);
                        font-family: "Noto Sans TC", "Figtree", sans-serif;
                        //font-family: "Figtree", sans-serif;
                        font-size: var(--inf-embedded-ad-font-9);
                        font-weight: 500;
                        line-height: 14px;
                        }
                        @media (min-width: 768px) {
                        #${containerId} .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price--original {
                        font-size: var(--inf-embedded-ad-font-12);
                        line-height: 17px;
                        }
                        }
                        #${containerId} .embeddedAdContainer .swiper-slide{
                        -webkit-backface-visibility: hide;
                        -webkit-transform：translate3d(0,0,0)；
                        }
                        #${containerId} .embeddedAdContainer .swiper-wrapper{
                        -webkit-transform-style:preserve-3d;
                        height: fit-content;
                        max-height: fit-content;
                        }
                        #${containerId} .swiper-slide {
                        will-change: transform;
                        }
                        #${containerId} .embeddedAdContainer:has(.swiper-grid) .swiper-prev,
                        #${containerId} .embeddedAdContainer:has(.swiper-grid) .swiper-next {
                          display: none;
                        }
                        #${containerId} .swiper-grid .swiper-slide {
                          padding-bottom: 0 !important;
                        }
                           @media (min-width: 768px) {
                            #${containerId} .swiper-grid .swiper-slide {
                              margin-top: 0 !important;
                            }
                            #${containerId} .swiper-grid .swiper-slide:nth-child(4),
                            #${containerId} .swiper-grid .swiper-slide:nth-child(5),
                            #${containerId} .swiper-grid .swiper-slide:nth-child(6) {
                              margin-top: 100px !important;
                            }
                           }
                        #${containerId} {
                        font-family: 'Figtree','Noto Sans TC',"微軟正黑體",sans-serif;
                        -webkit-font-smoothing: auto;
                        }
                        #${containerId}.small-container {
                          padding: 8px;
                        }
                        #${containerId}.small-container .embeddedAdContainer .embeddedAdContainer__title {
                          font-size: 16px;
                        }
                         #${containerId}.small-container .embeddedAdContainer .embeddedAdImgContainer .embeddedItem {
                         row-gap: 8px;
                         }
                        #${containerId}.small-container .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__title,
                        #${containerId}.small-container .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__price--original,
                        #${containerId}.small-container .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price,
                        #${containerId}.small-container .embeddedAdContainer .embeddedAdImgContainer .embeddedItem .embeddedItemInfo .embeddedItemInfo__content .embeddedItemInfo__price--original {
                          font-size: 12px;
                          line-height: 16px;
                          letter-spacing: 0.5px;
                        }
                        `;
        document.head.appendChild(customCSS);

        $(function () {
          let ids = ids_init();

          // console.log("DOM is ready");
          $(show_up_position_before).append(
            `<div id="recommendation-loading">
              <span class="loading-text">Loading...</span>
            </div>`
          );
          var embeddedContainer = `
                      <div class="embeddedAdContainer" id="embedded-ad-container-${containerId}">
                       <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <h2 class="embeddedAdContainer__title">${title}</h2>
                        <div class="title-navigation">
                          <div class="title-nav-prev">
                            <img src="data:image/svg+xml;charset=UTF-8,%3csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3crect x='24.5' y='24' width='24' height='24' rx='12' transform='rotate(-180 24.5 24)' fill='%233B3B32' fill-opacity='0.14'/%3e%3cg clip-path='url(%23clip0_544_432)'%3e%3cpath d='M14.4792 17.1621C14.7875 17.3576 15.175 17.3641 15.4896 17.1814C15.8042 16.9988 16 16.6551 16 16.2812V8.71875C16 8.34492 15.8042 8.00117 15.4896 7.81855C15.175 7.63593 14.7875 7.64453 14.4792 7.83789L8.47917 11.6191C8.18125 11.8061 8 12.1391 8 12.5C8 12.8609 8.18125 13.1918 8.47917 13.3809L14.4792 17.1621Z' fill='%23F3F3EF'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='clip0_544_432'%3e%3crect width='8' height='11' fill='white' transform='matrix(-1 0 0 -1 16 18)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e" />
                          </div>
                          <div class="title-nav-next">
                            <img src="data:image/svg+xml;charset=UTF-8,%3csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3crect x='0.5' width='24' height='24' rx='12' fill='%233B3B32' fill-opacity='0.14'/%3e%3cg clip-path='url(%23clip0_544_445)'%3e%3cpath d='M10.5208 6.83789C10.2125 6.64239 9.825 6.63594 9.51042 6.81856C9.19583 7.00117 9 7.34492 9 7.71875V15.2813C9 15.6551 9.19583 15.9988 9.51042 16.1814C9.825 16.3641 10.2125 16.3555 10.5208 16.1621L16.5208 12.3809C16.8188 12.1939 17 11.8609 17 11.5C17 11.1391 16.8188 10.8082 16.5208 10.6191L10.5208 6.83789Z' fill='%23F3F3EF'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='clip0_544_445'%3e%3crect width='8' height='11' fill='white' transform='translate(9 6)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e" />
                          </div>
                        </div>
                      </div>
                      <div
                      <div
                      class="embeddedAdImgContainer carouselContainer swiper swiper-basic-${containerId} ${
            window.SWIPER_GRID_AVAILABLE ? "swiper-grid" : ""
          }"
                      style="overflow: hidden;"
                      >
                        <div class="swiper-wrapper" id="swiper-wrapper-basic-${containerId}">
                        <!-- ad 內容將由 JavaScript 動態生成 -->
                        </div>
                      </div>
                      <div class="swiper-next a-right">
                      <img
                      src="data:image/svg+xml;charset=UTF-8,%3csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3crect x='0.5' width='24' height='24' rx='12' fill='%233B3B32' fill-opacity='0.14'/%3e%3cg clip-path='url(%23clip0_544_445)'%3e%3cpath d='M10.5208 6.83789C10.2125 6.64239 9.825 6.63594 9.51042 6.81856C9.19583 7.00117 9 7.34492 9 7.71875V15.2813C9 15.6551 9.19583 15.9988 9.51042 16.1814C9.825 16.3641 10.2125 16.3555 10.5208 16.1621L16.5208 12.3809C16.8188 12.1939 17 11.8609 17 11.5C17 11.1391 16.8188 10.8082 16.5208 10.6191L10.5208 6.83789Z' fill='%23F3F3EF'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='clip0_544_445'%3e%3crect width='8' height='11' fill='white' transform='translate(9 6)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e"
                      />
                      </div>
                      <div class="swiper-prev a-left">
                      <img
                      src="data:image/svg+xml;charset=UTF-8,%3csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3crect x='24.5' y='24' width='24' height='24' rx='12' transform='rotate(-180 24.5 24)' fill='%233B3B32' fill-opacity='0.14'/%3e%3cg clip-path='url(%23clip0_544_432)'%3e%3cpath d='M14.4792 17.1621C14.7875 17.3576 15.175 17.3641 15.4896 17.1814C15.8042 16.9988 16 16.6551 16 16.2812V8.71875C16 8.34492 15.8042 8.00117 15.4896 7.81855C15.175 7.63593 14.7875 7.64453 14.4792 7.83789L8.47917 11.6191C8.18125 11.8061 8 12.1391 8 12.5C8 12.8609 8.18125 13.1918 8.47917 13.3809L14.4792 17.1621Z' fill='%23F3F3EF'/%3e%3c/g%3e%3cdefs%3e%3cclipPath id='clip0_544_432'%3e%3crect width='8' height='11' fill='white' transform='matrix(-1 0 0 -1 16 18)'/%3e%3c/clipPath%3e%3c/defs%3e%3c/svg%3e"
                      />
                      </div>
                      </div>
                      `;

          // 添加窗口大小调整事件监听
          $(window).resize(function () {
            const newContainerWidth = $(show_up_position_before).width();

            if (arrowPosition === "none") {
              $(`#${containerId} .swiper-next`).css("display", "none");
              $(`#${containerId} .swiper-prev`).css("display", "none");
              $(`#${containerId} .swiper-next-corr`).css("display", "none");
              $(`#${containerId} .swiper-prev-corr`).css("display", "block");
              $(`#${containerId} .title-navigation`).css("display", "none");
            } else {
              if (arrowPosition === "center" && newContainerWidth >= 768) {
                $(`#${containerId} .swiper-next`).css("display", "block");
                $(`#${containerId} .swiper-prev`).css("display", "block");
                $(`#${containerId} .swiper-next-corr`).css("display", "block");
                $(`#${containerId} .swiper-prev-corr`).css("display", "block");
                $(`#${containerId} .title-navigation`).css("display", "none");
              } else {
                $(`#${containerId} .swiper-next`).css("display", "none");
                $(`#${containerId} .swiper-prev`).css("display", "none");
                $(`#${containerId} .swiper-next-corr`).css("display", "none");
                $(`#${containerId} .swiper-prev-corr`).css("display", "none");
                $(`#${containerId} .title-navigation`).css(
                  "display",
                  "inline-flex"
                );
              }
            }

            // 调整容器内边距
            $(show_up_position_before)
              .css(
                "padding",
                !!customPadding
                  ? customPadding
                  : newContainerWidth >= 768
                  ? "32px"
                  : "8px"
              )
              .toggleClass("small-container", newContainerWidth < 768);
            if (!!customPadding) {
              $(`#${containerId} ,small-container`).css(
                "padding",
                customPadding
              );
            }
          });

          function getGroupByTid(tid) {
            return tid % 2; // 將用戶平均分為 2 組 0 1
          }
          const tid = Date.now(); // 使用當前的 Unix 時間戳作為 tid
          const group = getGroupByTid(tid); // 來進行雙組分流 group == 0 or group == 1

          //Embedded
          if (typeof $(show_up_position_before)[0] !== "undefined") {
            $(show_up_position_before).css("background-color", backgroundColor);
            $(show_up_position_before).css("border-radius", "8px");
            // 獲取容器寬度並設置相應的內邊距
            const containerWidth = $(show_up_position_before).width();
            $(show_up_position_before).append(embeddedContainer);
            $(show_up_position_before)
              .css(
                "padding",
                !!customPadding
                  ? customPadding
                  : containerWidth >= 768
                  ? "32px"
                  : "8px"
              )
              .toggleClass("small-container", containerWidth < 768);
            if (!!customPadding) {
              $(`#${containerId} ,small-container`).css(
                "padding",
                customPadding
              );
            }

            const newContainerWidth = $(show_up_position_before).width();
            if (arrowPosition === "none") {
              $(`#${containerId} .swiper-next`).css("display", "none");
              $(`#${containerId} .swiper-prev`).css("display", "none");
              $(`#${containerId} .swiper-next-corr`).css("display", "none");
              $(`#${containerId} .swiper-prev-corr`).css("display", "block");
              $(`#${containerId} .title-navigation`).css("display", "none");
            } else {
              if (arrowPosition === "center" && newContainerWidth >= 768) {
                $(`#${containerId} .swiper-next`).css("display", "block");
                $(`#${containerId} .swiper-prev`).css("display", "block");
                $(`#${containerId} .swiper-next-corr`).css("display", "block");
                $(`#${containerId} .swiper-prev-corr`).css("display", "block");
                $(`#${containerId} .title-navigation`).css("display", "none");
              } else {
                $(`#${containerId} .swiper-next`).css("display", "none");
                $(`#${containerId} .swiper-prev`).css("display", "none");
                $(`#${containerId} .swiper-next-corr`).css("display", "none");
                $(`#${containerId} .swiper-prev-corr`).css("display", "none");
                $(`#${containerId} .title-navigation`).css(
                  "display",
                  "inline-flex"
                );
              }
            }
          } else {
            console.error("找不到容器元素:", show_up_position_before);
          }

          // Fetch the Bootstrap CSS from CDN
          // fetch('https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css')
          //   .then((response) => response.text())
          //   .then((css) => {
          //     // Scope the Bootstrap CSS to only work under .custom-scope class
          //     const scopedCSS = css
          //       .replace(/(^|\})\s*([^{]+)\s*\{/g, function (match, p1, p2) {
          //         // Ignore keyframes and other special rules
          //         if (p2.startsWith('@') || p2.startsWith(':root') || p2.startsWith('body')) {
          //           return match
          //         }
          //         return p1 + '.embeddedAdContainer ' + p2 + ' {'
          //       })
          //       .replace(/[^}]*\bbody\b[^}]*}/g, '')
          //       .replace(/\b(h[1-6])\b/g, '')

          //     // Inject the scoped CSS into the page
          //     document.getElementById('embedded-ad-bootstrap-scoped').textContent = scopedCSS
          //   })

          getEmbeddedAds(ids);
          // getEmbeddedAds_corr(ids);
        });

        $(document).on("click", `#${containerId} .embeddedItem`, function () {
          const title = $(this).data("title"); // 取得 data-title 屬性
          const link = $(this).data("link"); // 取得 data-link 屬性

          // 觸發 Google Analytics 的事件追蹤
          gtag("event", "click_embedded_item" + test, {
            send_to: GA4Key,
            event_category: "embedded",
            event_label: title,
            event_value: link,
          });
        });
        $(document).on("click", `#${containerId} .a-left`, function () {
          // 觸發 Google Analytics 的事件追蹤
          if (typeof gtag === "function") {
            gtag("event", "click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "embedded",
              event_label: "arrow-left",
              event_value: "left",
            });
          }
        });
        $(document).on("click", `#${containerId} .a-right`, function () {
          // 觸發 Google Analytics 的事件追蹤
          if (typeof gtag === "function") {
            gtag("event", "click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "embedded",
              event_label: "arrow-right",
              event_value: "right",
            });
          }
        });
        $(document).on("click", `#${containerId} .title-nav-prev`, function () {
          // 觸發上一頁輪播
          $(`#${containerId} .swiper-prev`).trigger("click");
        });
        $(document).on("click", `#${containerId} .title-nav-next`, function () {
          // 觸發下一頁輪播
          $(`#${containerId} .swiper-next`).trigger("click");
        });
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-corr .embeddedItem`,
          function () {
            const title = $(this).data("title"); // 取得 data-title 屬性
            const link = $(this).data("link"); // 取得 data-link 屬性

            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "corr_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-corr-embedded",
              event_label: "Title: " + title,
              value: link.length,
            });
          }
        );
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-corr .a-left`,
          function () {
            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "corr_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-corr-embedded",
              event_label: "arrow-left",
              value: 10,
            });
          }
        );
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-corr .a-right`,
          function () {
            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "corr_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-corr-embedded",
              event_label: "arrow-right",
              value: 10,
            });
          }
        );
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-basic .embeddedItem`,
          function () {
            const title = $(this).data("title"); // 取得 data-title 屬性
            const link = $(this).data("link"); // 取得 data-link 屬性

            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "bhv_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-basic-embedded",
              event_label: "Title: " + title,
              value: link.length,
            });
          }
        );
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-basic .a-left`,
          function () {
            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "bhv_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-basic-embedded",
              event_label: "arrow-left",
              value: 10,
            });
          }
        );
        $(document).on(
          "click",
          `#${containerId} #swiper-wrapper-basic .a-right`,
          function () {
            // 觸發 Google Analytics 的事件追蹤
            gtag("event", "bhv_click_embedded_item" + test, {
              send_to: GA4Key,
              event_category: "swiper-wrapper-basic-embedded",
              event_label: "arrow-right",
              value: 10,
            });
          }
        );

        function ids_init() {
          var makeid = function (length) {
            var result = "";
            var characters =
              "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            var charactersLength = characters.length;
            for (var i = 0; i < length; i++) {
              result += characters.charAt(
                Math.floor(Math.random() * charactersLength)
              );
            }
            return result;
          };
          //given id & member id --begin
          var member_id = "";
          var lgiven_id = "";

          member_id = member_id_Shopline();
          // console.log(member_id);

          // Always Generate a pair of LGVID
          lgvid_exist = false;
          try {
            if (typeof localStorage["LGVID"] !== "undefined") {
              lgvid_exist = true;
            } else {
              lgvid_exist = false;
            }
          } catch (e) {
            lgvid_exist = false;
          }
          if (lgvid_exist) {
            lgiven_id = localStorage["LGVID"];
          } else {
            lgiven_id = makeid(20);
            localStorage.setItem("LGVID", lgiven_id);
          }
          return {
            member_id: member_id,
            lgiven_id: lgiven_id,
            skuContent: skuContent,
          };
        }
        function getEmbeddedAds(ids) {
          const requestData = {
            Brand: Brand,
            LGVID: ids.lgiven_id,
            MRID: ids.member_id,
            recom_num: "6",
            PID: ids.skuContent,
            SP_PID:'skip'
            // ctype_val: JSON.stringify(["underwear"]),
          };
          if (!hide_size) {
            requestData.SIZEAI = "True";
            requestData.bid = bid;
          }
          const options = {
            method: "POST",
            headers: {
              accept: "application/json",
              "content-type": "application/json",
            },
            body: JSON.stringify(requestData),
          };
          function getRandomElements(arr, count) {
            const result = [];
            const usedIndexes = new Set();

            while (result.length < count) {
              const randomIndex = Math.floor(Math.random() * arr.length);
              if (!usedIndexes.has(randomIndex)) {
                result.push(arr[randomIndex]);
                usedIndexes.add(randomIndex);
              }
            }

            return result;
          }
          fetch(
            "https://gha6kqf5ff.execute-api.ap-northeast-1.amazonaws.com/v0/extension/recom_product",
            options
          )
            .then((response) => response.json())
            .then((response) => {
              let size_tag = {};

              if (response["SIZEAI_result"]) {
                size_tag = response["SIZEAI_result"].reduce((acc, item) => {
                  const itemScores = JSON.parse(item.ITEM);
                  const bestSize = Object.entries(itemScores)
                    .map(([size, percent]) => [size, parseFloat(percent)])
                    .sort((a, b) => b[1] - a[1])[0][0];
                  acc[item.productid] = bestSize;
                  return acc;
                }, {});
                
                // 檢查 bhv 是否為空陣列，如果是則使用 sp_atc
                const dataSource = (response["bhv"] && response["bhv"].length > 0) ? response["bhv"] : response["sp_atc"];
                
                if (dataSource) {
                  dataSource.forEach((item) => {
                    item.size_tag = size_tag[item.id];
                  });
                }
                if (response["corr"]) {
                  response["corr"].forEach((item) => {
                    item.size_tag = size_tag[item.id];
                  });
                }
              }

              //corr
              //or let jsonData_corr = getRandomElements(response['corr'], 12).map((item) => {})
              //bhv
              // 檢查 bhv 是否為空陣列，如果是則使用 sp_atc
              const dataSource = (response["bhv"] && response["bhv"].length > 0) ? response["bhv"] : response["sp_atc"];
              
              let jsonData =
                customEdm && customEdm.length > 0
                  ? customEdm
                  : getRandomElements(dataSource, dataSource.length < 6 ? dataSource.length : 6).map((item) => {
                      let newItem = Object.assign({}, item);
                      newItem.sale_price = hide_discount
                        ? null
                        : item.sale_price
                        ? parseInt(
                            item.sale_price.replace(/\D/g, "")
                          ).toLocaleString()
                        : "";
                      newItem.price = parseInt(
                        item.price.replace(/\D/g, "")
                      ).toLocaleString();
                      return newItem;
                    });
              $(`#recommendation-loading`).remove();
              if (window.innerWidth > 992) {
                if (jsonData.length >= 6) {
                  $(`#${containerId} .embeddedAdContainer`).show();
                  updatePopAd(jsonData);
                }
              } else {
                if (jsonData.length >= 4) {
                  $(`#${containerId} .embeddedAdContainer`).show();
                  updatePopAd(jsonData);
                }
              }
                            $("#intro-content-simple").remove();
                            $("#intro-content-advanced").show();
                            $("#loadingbar").hide();
            })
            .catch((err) => {
              console.error(err);
                            // 動態生成 intro-content-simple 來取代 intro-content-advanced
                            const simpleContent = `
                            <div id="intro-content-simple" class="intro-content intro-modal__content" style="opacity: 0; transition: opacity 0.3s ease-in-out;">
                              <div class="intro-logo intro-modal__logo intro-modal__logo--inf">
                                <img src="img/intro-logo.png" alt="intro logo" />
                              </div>
                              <div class="intro-logo intro-modal__logo">
                                <img src="img/start-animation.gif" alt="start animation" loading="lazy" />
                              </div>
                              <p class="intro-modal__title">開啟精準購物之旅</p>
                              <button id="start-button" class="intro-modal__btn--start">
                                <div>開始</div>
                                <img
                                  src="img/start-arrow.svg"
                                  alt="start arrow"
                                  class="intro-modal__btn--arrow"
                                />
                              </button>
                              <div class="intro-modal__icon">
                                <div class="intro-modal__icon--inffits">
                                  <div class="icon-inffits"></div>
                                  <div class="text-inffits">
                                    <p>
                                      使用本服務，即代表您同意 infFITS
                                      <a href="https://inffits.com/Privacy.html" target="_blank"
                                        >隱私權聲明</a
                                      >
                                      及
                                      <a href="https://inffits.com/Terms.html" target="_blank"
                                        >使用條款</a
                                      >。
                                    </p>
                                  </div>
                                </div>
                                <div class="intro-modal__icon--reminder">
                                  <div class="icon-reminder"></div>
                                  <div class="text-reminder">
                                    <p>
                                      您可以跳過部分提問，但我們建議完成整個選購流程，推薦結果將更精準。
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          `;
                          
                          // 移除 intro-content-advanced 並插入動態生成的內容
                          $("#intro-content-advanced").remove();
                          $("#intro-page").append(simpleContent);
                          $("#loadingbar").hide();
                          
                          // 等待圖片加載完成後再顯示內容
                          const $simpleContent = $("#intro-content-simple");
                          const $images = $simpleContent.find("img");
                          let loadedImages = 0;
                          const totalImages = $images.length;
                          
                          if (totalImages === 0) {
                            // 如果沒有圖片，直接顯示
                            $simpleContent.css("opacity", "1");
                          } else {
                            // 監聽所有圖片加載完成
                            $images.each(function() {
                              const $img = $(this);
                              if ($img[0].complete) {
                                loadedImages++;
                                checkAllImagesLoaded();
                              } else {
                                $img.on("load", function() {
                                  loadedImages++;
                                  checkAllImagesLoaded();
                                }).on("error", function() {
                                  loadedImages++;
                                  checkAllImagesLoaded();
                                });
                              }
                            });
                          }
                          
                          function checkAllImagesLoaded() {
                            if (loadedImages >= totalImages) {
                              // 所有圖片加載完成，平滑顯示內容
                              setTimeout(() => {
                                $simpleContent.css("opacity", "1");
                              }, 100);
                            }
                          }
                          // 移除重複的事件綁定，iframe.js 中已有完整的 start-button 事件處理邏輯
                          
                          // 移除重複的圖標事件綁定，iframe.js 中已有完整的圖標事件處理邏輯
            });
        }

        function updatePopAd(images, corr_bool) {
          const items = images
            .map(
              (img) =>
                `
    <a class="embeddedItem swiper-slide" href="${
      img.link
    }" target="_blank" data-title="${img.title}" data-link="${img.link}">
      <div class="embeddedItem__img" style="position:relative;">
      <div class="embeddedItem__imgBox" style="background-color:#efefef;">
      ${
        img.size_tag
          ? `<div class="embeddedItem__sizeTag">${img.size_tag}</div>`
          : ""
      }
          <img src="${img.image_link}" loading="lazy" alt="${
                  img.description
                }" style="width: 100%; height: auto; object-fit: cover;">
      </div>
      </div>
      <div class="embeddedItemInfo">
          <h3 class="embeddedItemInfo__title">${img.title}</h3>
          ${
            img.sale_price && img.sale_price !== img.price
              ? `<div class="embeddedItemInfo__content">
              <p class="embeddedItemInfo__discount">${Math.ceil(
                100 -
                  (parseInt(img.sale_price.replace(",", "")) * 100) /
                    parseInt(img.price.replace(",", ""))
              )}% off</p>
                  <p class="embeddedItemInfo__price">NT$ ${img.sale_price}</p>
                  `
              : `<div class="embeddedItemInfo__content"> 
                  <p class="embeddedItemInfo__discount" style="display:none;">5% off</p>               
                  <p class="embeddedItemInfo__price">NT$ ${img.price}</p>
                  `
          }
              </div>
      </div>
    </a>
    `
            )
            .join("");

          $(`#swiper-wrapper-basic-${containerId}`).html(items);
          var swiper = new Swiper(`.swiper-basic-${containerId}`, {
            direction: "horizontal",
            loop: false,
            pagination: false,
            autoplay: !autoplay
              ? false
              : {
                  delay: 4000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                  // 重要：確保自動播放不會在切換頁面時出錯
                  stopOnLastSlide: false,
                  waitForTransition: true,
                },

            // 保持簡單的基礎設定
            slidesPerView: 1,
            slidesPerGroup: 1,
            loopFillGroupWithBlank: true,
            spaceBetween: 8,

            // Swiper 11 网格视图配置
            grid: {
              rows: finalConfig?.breakpoints[768].gridRows,
              fill: "row",
            },

            // 導航按鈕
            navigation: {
              nextEl: `#${containerId} .swiper-next`,
              prevEl: `#${containerId} .swiper-prev`,
            },

            // 简化触摸设置以适应所有设备
            simulateTouch: true,
            touchRatio: 1,
            resistance: true,
            resistanceRatio: 0.65,

            // 保留基本的觀察者設定
            observer: true,
            observeParents: true,

            // 事件处理 - 简化与 Swiper 11 兼容的版本
            on: {
              init: function () {
                this.params.easing = "cubic-bezier(0.25, 0.1, 0.25, 1)";

                const swiperEl = this.el;
                let isDragging = false;
                let moved = false;
                let startX;
                let startY;

                // 只在非觸控設備上添加滑鼠事件處理
                if (window.matchMedia("(hover: hover)").matches) {
                  swiperEl.addEventListener("mousedown", function (e) {
                    isDragging = true;
                    moved = false;
                    startX = e.pageX;
                    startY = e.pageY;
                  });

                  document.addEventListener("mousemove", function (e) {
                    if (!isDragging) return;

                    const diffX = Math.abs(e.pageX - startX);
                    const diffY = Math.abs(e.pageY - startY);

                    if (diffX > 5 || diffY > 5) {
                      moved = true;
                    }
                  });

                  document.addEventListener("mouseup", function () {
                    isDragging = false;
                  });

                  // 只處理連結點擊
                  const slides = swiperEl.querySelectorAll(".swiper-slide a");
                  slides.forEach((link) => {
                    link.addEventListener("click", function (e) {
                      if (moved) {
                        e.preventDefault();
                      }
                    });
                  });
                }
              },

              // 保留原版的 resize 處理
              resize: function () {
                setTimeout(() => {
                  this.update();
                }, 500);
              },
            },

            // 响应式设置，兼容 Swiper 11
            breakpoints: sortedBreakpoints,
            on: {
              init: function () {
                // console.log("生效的斷點配置:");
              },
            },
            // breakpoints: {
            //   768: {
            //     speed: 750,
            //     spaceBetween: 24,
            //     slidesPerView: slidesPerView,
            //     slidesPerGroup: slidesPerView * gridRows,
            //     grid: {
            //       rows: gridRows,
            //       fill: 'row'
            //     },
            //     // 移除 mousewheel 配置，使用单独的模块
            //     threshold: 10
            //   },
            //   0: {
            //     slidesPerView: mobileSlidesPerView,
            //     slidesPerGroup: mobileSlidesPerView * mobileGridRows,
            //     spaceBetween: 24,
            //     speed: 750,
            //     resistanceRatio: 0,
            //     grid: {
            //       rows: mobileGridRows,
            //       fill: 'row'
            //     }
            //   }
            // }
          });
        }
        // }
      })(jQuery);
    }
    //jQuery loaded
    ensureEmbeddedAdJQueryLoaded(loadEmbeddedScript);
    // }
  }
  window.Product_Recommendation = Product_Recommendation;
})();
