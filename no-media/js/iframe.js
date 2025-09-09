var reset;
var Route = "";
var Brand = "";
var SpecifyTags = [];
var SpecifyKeywords = [];
var themeBackgroundImages = [];
var tags_chosen = {};
let startX, endX;
let current_route_path;
let current_Route;
let all_Route;
let isFirst = true;
let throttleTimer = null;
let formatTagGroupMap = {};
let isFetchCouponCalled = false;
let isForPreview = true || window.location.href
  .toLocaleLowerCase()
  .includes("myinffits")

let isForReferral = window.location.href
  .toLocaleLowerCase()
  .includes("referral");
let firstResult = {};

function throttle(fn, delay) {
  let isFirstCall = true; // 用來判斷是否是第一次調用
  return function (...args) {
    if (isFirstCall) {
      fn.apply(this, args); // 第一次調用立即執行
      isFirstCall = false;
      throttleTimer = setTimeout(() => {
        throttleTimer = null; // 清除計時器
      }, delay);
    } else if (!throttleTimer) {
      throttleTimer = setTimeout(() => {
        fn.apply(this, args);
        throttleTimer = null;
      }, delay);
    }
  };
}

$(document).ready(function () {
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
    "https://fonts.googleapis.com/css2?family=Chocolate+Classical+Sans&family=Figtree:ital,wght@0,300..900;1,300..900&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap";
  document.head.appendChild(googleFontLink3);
  $("#intro-page").on("pointerdown", function (e) {
    if ($(e.target).closest(".intro-content").length) {
      return; // 如果點擊在 .intro-content 內，則不執行後續操作
    }
    const messageData = {
      type: "closeModal",
      value: true,
    };
    $(".icon-reminder").removeClass("open");
    $(".text-reminder").removeClass("visible");
    $(".icon-inffits").removeClass("open");
    $(".text-inffits").removeClass("visible");
    window.parent.postMessage(messageData, "*");
  });
  $(".intro-content").on("pointerdown", function (e) {
    $(".icon-reminder").removeClass("open");
    $(".text-reminder").removeClass("visible");
    $(".icon-inffits").removeClass("open");
    $(".text-inffits").removeClass("visible");
  });
});

let isFetching = false; // 新增標誌
const get_recom_res = () => {
  if (isFetching) return;
  isFetching = true;
  $("#loadingbar_recom").show();
  if (isForReferral) {
    const messageData = {
      type: "loadingBar",
      value: true,
    };
    window.parent.postMessage(messageData, "*");
  }

  const formatTags = Object.fromEntries(
    Object.entries(tags_chosen)
      .map(([key, value]) => [
        key,
        value.filter((item) => item.Name !== "example"), // 過濾掉 Name 為 "example" 的項目
      ])
      .filter(([_, value]) => value.length > 0) // 移除值為空陣列的鍵
  );
  let options = {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      Brand: Brand,
      Tags: tags_chosen,
      NUM: 12,
      SpecifyTags: SpecifyTags,
      SpecifyKeywords: SpecifyKeywords,
    }),
  };
  if (isForReferral) {
    const messageData = {
      type: "result_store",
      [`${Brand}_${current_route_path.Route}`]: tags_chosen,
    };
    window.parent.postMessage(messageData, "*");
    // console.error("messageData", messageData);
  }

  // console.warn("tags chosen:", tags_chosen);
  var INFS_ROUTE_ORDER = !isForPreview
    ? JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) || []
    : [];
  INFS_ROUTE_ORDER.forEach((item, index) => {
    if (deepEqualWithoutKey(item, current_route_path, ["Record"])) {
      INFS_ROUTE_ORDER[index] = {
        ...item,
        Record: tags_chosen, // 修改 Record
      };
    }
  });
  var INFS_ROUTE_RES = !isForPreview
    ? JSON.parse(localStorage.getItem(`INFS_ROUTE_RES_${Brand}`)) || []
    : [];

  const matchIndex = INFS_ROUTE_ORDER.findIndex((item) =>
    deepEqualWithoutKey(item, current_route_path, ["Record"])
  );

  // 如果找到了，則將其移到 INFS_ROUTE_RES
  if ((matchIndex !== -1) & !isForPreview) {
    // console.error("matchIndex", matchIndex);
    // console.error("isForPreview", isForPreview);
    const matchedItem = INFS_ROUTE_ORDER.splice(matchIndex, 1)[0]; // 移除並取得物件
    INFS_ROUTE_RES.push(matchedItem); // 將物件推到 RES 陣列

    // 更新 localStorage
    if (!isForPreview) {
      localStorage.setItem(
        `INFS_ROUTE_ORDER_${Brand}`,
        JSON.stringify(INFS_ROUTE_ORDER)
      );
      localStorage.setItem(
        `INFS_ROUTE_RES_${Brand}`,
        JSON.stringify(INFS_ROUTE_RES)
      );
    }
  }
  // tags_chosen = {};

  fetch(
    "https://api.inffits.com/http_mkt_extensions_recom/recom_product",
    // "https://ldiusfc4ib.execute-api.ap-northeast-1.amazonaws.com/v0/extension/recom_product",
    options
  )
    .then((response) => response.json())
    .then(async (response) => {
      // setTimeout(() => {
      const messageData = {
        type: "result",
        value: true,
      };
      window.parent.postMessage(messageData, "*");
      // console.error("Message", response);
      firstResult = response;
      await show_results(response, true);
      // }, 1500);
    })
    .catch((err) => {
      console.error("err", err);
    })
    .finally(() => {
      if (isForReferral) {
        const messageData = {
          type: "loadingBar",
          value: false,
        };
        window.parent.postMessage(messageData, "*");
      }
      setTimeout(() => {
        // $("#loadingbar_recom").fadeOut(500);
        isFetching = false;
      }, 2200);
    });
};

const getEmbedded = async () => {
  const requestData = {
    Brand: Brand,
    LGVID: "SObQG1eZ0oxzKmpgT2dc",
    MRID: "",
    recom_num: "12",
    PID: "",
    SP_PID:'skip'
  };
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestData),
  };

  try {
    const response = await fetch(
      "https://api.inffits.com/HTTP_inf_bhv_cdp_product_recommendation/extension/recom_product",
      options
    );
    const data = await response.json();
    
    // 檢查 bhv 是否為空陣列，如果是則使用 sp_atc
    const dataSource = (data["bhv"] && data["bhv"].length > 0) ? data["bhv"] : data["sp_atc"];
    
    // 如果兩個資料源都為空，則呼叫 getEmbeddedForBackup
    if (!dataSource || dataSource.length === 0) {
      getEmbeddedForBackup();
      return;
    }
    
    let jsonData = getRandomElements(dataSource, dataSource.length < 6 ? dataSource.length : 6).map((item) => {
      let newItem = Object.assign({}, item);
      newItem.sale_price = item.sale_price
        ? parseInt(item.sale_price.replace(/\D/g, "")).toLocaleString("en-US", {
            style: "currency",
            currency: "TWD",
            minimumFractionDigits: 0,
          })
        : "";
      newItem.price = parseInt(item.price.replace(/\D/g, "")).toLocaleString(
        "en-US",
        {
          style: "currency",
          currency: "TWD",
          minimumFractionDigits: 0,
        }
      );
      return newItem;
    });

    const formatItems = jsonData.map((jsonDataItem) => ({
      Imgsrc: jsonDataItem.image_link,
      Link: jsonDataItem.link,
      ItemName: jsonDataItem.title,
      sale_price: jsonDataItem.sale_price,
      price: jsonDataItem.price,
      ...jsonDataItem,
    }));

    // console.error("jsonData", jsonData);
    // console.error("formatItems", formatItems);

    const formatData = {
      Item: formatItems,
    };

    $("#recommend-title").text("猜你可能喜歡");
    $("#recommend-desc").text("目前無符合結果，推薦熱門商品給你。");
    $("#recommend-btn").text("刷新推薦");
    show_results(formatData);
  } catch (err) {
    console.error(err);
    getEmbeddedForBackup();
  }
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
const getEmbeddedForBackup = () => {
  const requestData = {
    Brand: Brand,
    LGVID:"2Zdl1XTfRX3FdvPqGEhs",
    MRID:"",
    PID:"搭配商品的pid",
    recom_num: "12",
    SP_PID:"xxSOCIAL PROOF"
  };
  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestData),
  };
  fetch(
    "https://api.inffits.com/HTTP_inf_bhv_cdp_product_recommendation/extension/recom_product",
    options
  )
    .then((response) => response.json())
    .then((response) => {
      // 檢查 bhv 是否為空陣列，如果是則使用 sp_atc
      const dataSource = (response["bhv"] && response["bhv"].length > 0) ? response["bhv"] : response["sp_atc"];
      
      // 如果兩個資料源都為空，則點擊重新開始按鈕
      if (!dataSource || dataSource.length === 0) {
        // 點擊重新開始按鈕
        $("#startover").click();
        return;
      }
      
      let jsonData = getRandomElements(dataSource, dataSource.length < 6 ? dataSource.length : 6).map((item) => {
        let newItem = Object.assign({}, item);
        newItem.sale_price = item.sale_price
          ? parseInt(item.sale_price.replace(/\D/g, "")).toLocaleString(
              "en-US",
              {
                style: "currency",
                currency: "TWD",
                minimumFractionDigits: 0,
              }
            )
          : "";
        newItem.price = parseInt(item.price.replace(/\D/g, "")).toLocaleString(
          "en-US",
          {
            style: "currency",
            currency: "TWD",
            minimumFractionDigits: 0,
          }
        );
        return newItem;
      });
      const formatItems = jsonData.map((jsonDataItem) => {
        return {
          Imgsrc: jsonDataItem.image_link,
          Link: jsonDataItem.link,
          ItemName: jsonDataItem.title,
          sale_price: jsonDataItem.sale_price,
          price: jsonDataItem.price,
          ...jsonDataItem,
        };
      });

      // console.error("jsonData", jsonData);
      // console.error("formatItems", formatItems);

      const formatData = {
        Item: formatItems,
      };
      $("#recommend-title").text("猜你可能喜歡");
      $("#recommend-desc").text("目前無符合結果，推薦熱門商品給你。");
      $("#recommend-btn").text("刷新推薦");
      show_results(formatData);
      $("#container-recom").show();
      localStorage.setItem(
        `INFS_ROUTE_RES_${Brand}`,
        JSON.stringify([])
      );
    })
    .catch((err) => {
      console.error(err);
    });
};

const show_results = (response, isFirst = false) => {
  //只出現其中三個}
  const itemCount = response?.Item?.length || 0;
  // 如果項目數量小於 3，只顯示所有可用的項目
  const displayCount = Math.min(itemCount, 3);

  function getTopCommonIndices() {
    // 取得排序後的索引值陣列
    const indices = firstResult.Item.map((item, index) => ({
      index,
      common: item.COMMON,
    }))
      .sort((a, b) => b.common - a.common)
      .map((obj) => obj.index);

    // 取前最多 3 筆
    return indices.slice(0, 3);
  }

  function getRandomNumbers(max, count) {
    let randomNumbers = [];
    while (randomNumbers.length < count) {
      let num = Math.floor(Math.random() * max);
      if (!randomNumbers.includes(num)) {
        randomNumbers.push(num);
      }
    }
    return randomNumbers;
  }

  if (itemCount === 0 || !response) {
    getEmbedded();
    localStorage.setItem(
      `INFS_ROUTE_RES_${Brand}`,
      JSON.stringify([])
    );
    return;
  } else {
    $("#container-recom").show();
  }
  // const finalitem = getRandomNumbers(itemCount - 1, 3);
  const finalitem = isFirst
    ? getTopCommonIndices()
    : getRandomNumbers(itemCount, displayCount);
  // console.error("finalitem", finalitem);
  const finalitemCount = 3;
  $(`#container-recom`).find(".axd_selections").html("");

  for (let ii in finalitem) {
    let i = finalitem[ii];
    var ItemName = response.Item[i].ItemName;
    // if (ItemName.length >= 16) {
    //   ItemName = ItemName.substring(0, 15) + "...";
    // }
    $(`#container-recom`).find(".axd_selections").append(`
      <div class="axd_selection cursor-pointer update_delete">
 <a href="${
   response.Item[i].Link
 }" target="_blank" class="update_delete" style="text-decoration: none;">
    <div style="overflow: hidden;">
         <img loading="lazy" class="c-recom" id="container-recom-${i}" data-item="0"  src="./../../img/img-default-large.png" data-src=" ${
      response.Item[i].Imgsrc
    }" onerror="this.onerror=null;this.src='./../../img/img-default-large.png'"
         >
         </div>
         <div class="recom-info">
         <p class="recom-text item-title line-ellipsis-2" id="recom-${i}-text">${ItemName}</p>
           <div class="discount-content">
             <p class="item-price recom-price">${
               response.Item[i].sale_price || response.Item[i].price || "-"
             }</p>
             </div>
         </div>
 </a>
  </div>
 `);
    $(`#container-recom img.c-recom`).each(function () {
      var $img = $(this);

      // 設置圖片初始 opacity 為 0
      $img.css("opacity", 0);

      // 創建一個新的 Image 對象來監聽加載事件
      var realImg = new Image();
      realImg.src = $img.data("src");

      // 當圖片加載完成後，替換佔位符並做淡入效果
      $(realImg)
        .on("load", function () {
          $img.attr("src", $img.data("src")); // 將佔位符圖片替換為真實圖片
          $img.animate({ opacity: 1 }, 1500); // 在1500毫秒內淡入圖片
        })
        .on("error", function () {
          // 處理圖片加載錯誤的情況
          $img.attr("src", "./../../img/img-default-large.png"); // 顯示預設錯誤圖片
          $img.animate({ opacity: 1 }, 1500); // 錯誤圖片也淡入
        });
    });
  }

  const selectionContainer = document.querySelector(
    `#container-recom .selection`
  );

  if (finalitemCount === 2) {
    selectionContainer.classList.add("two-elements");
  } else if (finalitemCount === 3) {
    selectionContainer.classList.add("three-elements");

    if (selectionContainer) {
      const axdSelections =
        selectionContainer.querySelectorAll(".axd_selection");
      if (axdSelections.length > 2) {
        axdSelections[2].classList.add("overflow-opacity");
      }
    }

    document
      .querySelector(".three-elements .axd_selections")
      .addEventListener("scroll", function (e) {
        var container = e.target;
        var selections = container.querySelectorAll(".axd_selection");

        selections.forEach(function (selection, index) {
          if (isVisible(selection, container)) {
            selection.classList.remove("overflow-opacity");
          } else {
            selection.classList.add("overflow-opacity");
          }
        });
      });

    function isVisible(element, container) {
      var elementRect = element.getBoundingClientRect();
      var containerRect = container.getBoundingClientRect();

      return (
        elementRect.right < containerRect.right &&
        elementRect.left > containerRect.left
      );
    }
  } else if (finalitemCount >= 4) {
    // selectionContainer.classList.add("four-elements");
  }
};

// 深度比較函數（排除指定屬性）
function deepEqualWithoutKey(obj1, obj2, ignoreKeys = []) {
  const filteredObj1 = Object.fromEntries(
    Object.entries(obj1).filter(([key]) => !ignoreKeys.includes(key))
  );
  const filteredObj2 = Object.fromEntries(
    Object.entries(obj2).filter(([key]) => !ignoreKeys.includes(key))
  );
  return deepEqual(filteredObj1, filteredObj2);
}

// 通用深度比較函數
function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (
    typeof obj1 !== "object" ||
    typeof obj2 !== "object" ||
    obj1 === null ||
    obj2 === null
  ) {
    return false;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  return keys1.every((key) => deepEqual(obj1[key], obj2[key]));
}

const fetchCoupon = async () => {
  if (isFetchCouponCalled) return;
  isFetchCouponCalled = true;
  const requestData = {
    Brand: Brand,
    Module: "Personalized_Landing_Widget",
  };

  const options = {
    method: "POST",
    headers: { accept: "application/json" },
    body: JSON.stringify(requestData),
  };
  const response = await fetch(
    "https://api.inffits.com/mkt_brand_config_proc/GetItems",
    options
  );
  const responseData = await response.json();
  // console.log('responseData', responseData)
  const currentData = responseData.find(item => item.Module === 'Personalized_Landing_Widget');
  // console.log('currentData', currentData)
  const data = currentData?.ConfigData?.Discount_Info || [{
    Title: '敬請期待',
    Description: '敬請期待',
    TimeValid: null,
    Code: '敬請期待',
    status: false,
  }];
  if (data && data.length > 0) {}
    $("#intro-coupon-modal__content-coupons").html(
      data
        .map((item) => {
          // 首先檢查 status
          if (item.status === false) {
            // 如果 status 為 false，顯示帶蒙層的優惠券
            return `
            <div class="intro-coupon-modal__content-container-content" style="position: relative;">
                <div class="intro-coupon-modal__content-container-content-icon">
                  <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 512.000000 512.000000" preserveAspectRatio="xMidYMid meet" style="width: 30px; height: 30px;">
                    <g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
                      <path d="M78 4189 c-23 -12 -46 -35 -58 -59 -19 -38 -20 -58 -20 -520 0 -462 1 -482 20 -520 23 -46 81 -80 134 -80 111 0 228 -50 311 -134 71 -71 110 -147 127 -247 23 -131 -23 -277 -118 -379 -74 -79 -214 -140 -320 -140 -53 0 -111 -34 -134 -80 -19 -38 -20 -58 -20 -520 0 -462 1 -482 20 -520 13 -26 34 -47 60 -60 39 -20 53 -20 2480 -20 2427 0 2441 0 2480 20 26 13 47 34 60 60 20 39 20 56 20 1570 0 1514 0 1531 -20 1570 -13 26 -34 47 -60 60 -39 20 -53 20 -2482 20 -2413 -1 -2443 -1 -2480 -21z m1134 -378 c3 -107 13 -132 72 -175 40 -30 120 -29 165 3 47 34 61 75 61 181 l0 90 1655 0 1655 0 0 -1350 0 -1350 -1660 0 -1660 0 0 90 c0 112 -20 159 -80 190 -50 25 -90 25 -140 0 -60 -31 -80 -78 -80 -190 l0 -90 -450 0 -450 0 0 308 0 308 52 14 c196 50 374 200 471 395 56 115 71 183 71 325 0 129 -10 186 -56 295 -55 132 -183 276 -313 353 -67 39 -177 82 -210 82 -13 0 -15 38 -15 310 l0 310 454 0 454 0 4 -99z"></path>
                      <path d="M2765 3596 c-84 -21 -147 -57 -211 -121 -177 -176 -177 -453 1 -630 258 -259 695 -118 757 244 24 141 -22 281 -127 387 -112 113 -269 158 -420 120z m175 -306 c45 -23 80 -80 80 -130 0 -76 -74 -150 -151 -150 -46 0 -108 39 -130 82 -37 72 -14 151 57 194 48 29 92 30 144 4z"></path>
                      <path d="M4001 3592 c-28 -14 -139 -174 -654 -947 -678 -1017 -651 -969 -608 -1053 24 -46 80 -82 130 -82 84 0 59 -32 711 946 334 500 615 924 624 942 64 123 -76 257 -203 194z"></path>
                      <path d="M1278 3289 c-68 -35 -78 -71 -78 -279 0 -161 2 -185 20 -220 23 -45 80 -80 130 -80 50 0 107 35 130 80 18 35 20 59 20 220 0 161 -2 185 -20 220 -37 73 -127 99 -202 59z"></path>
                      <path d="M1278 2389 c-68 -35 -78 -71 -78 -279 0 -161 2 -185 20 -220 23 -45 80 -80 130 -80 50 0 107 35 130 80 18 35 20 59 20 220 0 161 -2 185 -20 220 -37 73 -127 99 -202 59z"></path>
                      <path d="M3965 2396 c-84 -21 -147 -57 -211 -121 -177 -176 -177 -453 1 -630 258 -259 695 -118 757 244 24 141 -22 281 -127 387 -112 113 -269 158 -420 120z m175 -306 c45 -23 80 -80 80 -130 0 -76 -74 -150 -151 -150 -46 0 -108 39 -130 82 -37 72 -14 151 57 194 48 29 92 30 144 4z"></path>
                    </g>
                  </svg>
                </div>
                <div class="intro-coupon-modal__content-container-content-line">
                  <svg xmlns="http://www.w3.org/2000/svg" width="2" height="44" viewBox="0 0 2 44" fill="none">
                    <path d="M1 1V43" stroke="#E0E0DF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 8"/>
                  </svg>
                </div>
                <div class="intro-coupon-modal__content-container-content-text">
                  <p>${item.Title}</p>
                  <div class="intro-coupon-modal__content-container-content-footer">
                    <p>${item.Description}</p>
                    <button class="intro-coupon-modal__btn--coupon intro-coupon-modal__btn--coupon--disabled">領取</button>
                  </div>
                </div>
                <!-- 蒙層 -->
                <div style="
                  position: absolute;
                  top: 0;
                  left: 0;
                  right: 0;
                  bottom: 0;
                  background: rgba(255, 255, 255, 0.75);
                  backdrop-filter: blur(3px);
                  -webkit-backdrop-filter: blur(3px);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 16px;
                  font-weight: bold;
                  color: #666;
                  border-radius: 8px;
                ">
                  敬請期待
                </div>
              </div>
        `;
          }
          
          // 如果 status 為 true，執行原本的日期判斷邏輯
          // 解析 TimeValid 日期範圍
          const timeValidParts = item.TimeValid ? item.TimeValid.split('~') : [];
          const startDate = timeValidParts[0] ? new Date(timeValidParts[0]) : null;
          const endDate = timeValidParts[1] ? new Date(timeValidParts[1]) : null;
          const currentDate = new Date();
          
          // 判斷按鈕狀態
          let buttonHtml = '';
          if (startDate && currentDate < startDate) {
            // 尚未開始
            buttonHtml = '<button class="intro-coupon-modal__btn--coupon intro-coupon-modal__btn--coupon--disabled">尚未開始</button>';
          } else if (endDate && currentDate > endDate) {
            // 已結束
            buttonHtml = '<button class="intro-coupon-modal__btn--coupon intro-coupon-modal__btn--coupon--disabled">已結束</button>';
          } else {
            // 可以領取
            buttonHtml = `
              <button class="intro-coupon-modal__btn--coupon intro-coupon-modal__btn--coupon--copy" onclick="copyCoupon('${item.Code}', this)">領取</button>
              <button class="intro-coupon-modal__btn--coupon intro-coupon-modal__btn--coupon--copied">已領取</button>
            `;
          }
          
          return `
          <div class="intro-coupon-modal__content-container-content">
              <div class="intro-coupon-modal__content-container-content-icon">
                <svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 512.000000 512.000000" preserveAspectRatio="xMidYMid meet" style="width: 30px; height: 30px;">
                  <g transform="translate(0.000000,512.000000) scale(0.100000,-0.100000)" fill="#000000" stroke="none">
                    <path d="M78 4189 c-23 -12 -46 -35 -58 -59 -19 -38 -20 -58 -20 -520 0 -462 1 -482 20 -520 23 -46 81 -80 134 -80 111 0 228 -50 311 -134 71 -71 110 -147 127 -247 23 -131 -23 -277 -118 -379 -74 -79 -214 -140 -320 -140 -53 0 -111 -34 -134 -80 -19 -38 -20 -58 -20 -520 0 -462 1 -482 20 -520 13 -26 34 -47 60 -60 39 -20 53 -20 2480 -20 2427 0 2441 0 2480 20 26 13 47 34 60 60 20 39 20 56 20 1570 0 1514 0 1531 -20 1570 -13 26 -34 47 -60 60 -39 20 -53 20 -2482 20 -2413 -1 -2443 -1 -2480 -21z m1134 -378 c3 -107 13 -132 72 -175 40 -30 120 -29 165 3 47 34 61 75 61 181 l0 90 1655 0 1655 0 0 -1350 0 -1350 -1660 0 -1660 0 0 90 c0 112 -20 159 -80 190 -50 25 -90 25 -140 0 -60 -31 -80 -78 -80 -190 l0 -90 -450 0 -450 0 0 308 0 308 52 14 c196 50 374 200 471 395 56 115 71 183 71 325 0 129 -10 186 -56 295 -55 132 -183 276 -313 353 -67 39 -177 82 -210 82 -13 0 -15 38 -15 310 l0 310 454 0 454 0 4 -99z"></path>
                    <path d="M2765 3596 c-84 -21 -147 -57 -211 -121 -177 -176 -177 -453 1 -630 258 -259 695 -118 757 244 24 141 -22 281 -127 387 -112 113 -269 158 -420 120z m175 -306 c45 -23 80 -80 80 -130 0 -76 -74 -150 -151 -150 -46 0 -108 39 -130 82 -37 72 -14 151 57 194 48 29 92 30 144 4z"></path>
                    <path d="M4001 3592 c-28 -14 -139 -174 -654 -947 -678 -1017 -651 -969 -608 -1053 24 -46 80 -82 130 -82 84 0 59 -32 711 946 334 500 615 924 624 942 64 123 -76 257 -203 194z"></path>
                    <path d="M1278 3289 c-68 -35 -78 -71 -78 -279 0 -161 2 -185 20 -220 23 -45 80 -80 130 -80 50 0 107 35 130 80 18 35 20 59 20 220 0 161 -2 185 -20 220 -37 73 -127 99 -202 59z"></path>
                    <path d="M1278 2389 c-68 -35 -78 -71 -78 -279 0 -161 2 -185 20 -220 23 -45 80 -80 130 -80 50 0 107 35 130 80 18 35 20 59 20 220 0 161 -2 185 -20 220 -37 73 -127 99 -202 59z"></path>
                    <path d="M3965 2396 c-84 -21 -147 -57 -211 -121 -177 -176 -177 -453 1 -630 258 -259 695 -118 757 244 24 141 -22 281 -127 387 -112 113 -269 158 -420 120z m175 -306 c45 -23 80 -80 80 -130 0 -76 -74 -150 -151 -150 -46 0 -108 39 -130 82 -37 72 -14 151 57 194 48 29 92 30 144 4z"></path>
                  </g>
                </svg>
              </div>
              <div class="intro-coupon-modal__content-container-content-line">
                <svg xmlns="http://www.w3.org/2000/svg" width="2" height="44" viewBox="0 0 2 44" fill="none">
                  <path d="M1 1V43" stroke="#E0E0DF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 8"/>
                </svg>
              </div>
                 <div class="intro-coupon-modal__content-container-content-text">
                <p>${item.Title}</p>
                <div class="intro-coupon-modal__content-container-content-footer">
                  <p>${item.Description}</p>
                  ${buttonHtml}
                </div>
              </div>
            </div>
      `;
        })
        .join("")
    );
    window.Product_Recommendation({
      brand: Brand,
      containerId: "hot-sale",
      customEdm: [],
      customPadding: "0px",
      backgroundColor: "#fff",
      title: "",
      arrowPosition: "none", // none, center, top (default: center)
      autoplay: false,
      hide_discount: true, // 隱藏折扣
      hide_size: true, // 隱藏尺寸
      bid: {
        HV: "165",
        WV: "45",
        CC: "97.5_97.5",
        DataItem: "0100",
        Shoulder: "",
        UpChest: "",
        DnChest: "",
        Waist: "",
        Hip: "",
        Brand: Brand,
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
        480: {
          slidesPerView: 3.5,
          slidesPerGroup: 1,
          spaceBetween: 8,
          speed: 750,
          resistanceRatio: 0,
          grid: {
            rows: 1,
            fill: "row",
          },
        },
        0: {
          slidesPerView: 3.5,
          slidesPerGroup: 1,
          spaceBetween: 8,
          speed: 750,
          resistanceRatio: 0,
          grid: {
            rows: 1,
            fill: "row",
          },
        },
      },
    });
    // 响应父页面的高度请求
    window.addEventListener(
      "message",
      function (event) {
        if (event.data && event.data.type === "requestHeight") {
          // 获取当前文档高度
          const height =
            document.documentElement.offsetHeight || document.body.offsetHeight;
          // 发送高度信息给父页面
          window.parent.postMessage(
            {
              type: "setHeight",
              height: height,
            },
            "*"
          );
        }
      },
      false
    );

    // 页面加载和内容变化时也发送高度
    function sendHeight() {
      const height =
        document.documentElement.offsetHeight || document.body.offsetHeight;
      window.parent.postMessage(
        {
          type: "setHeight",
          height: height,
        },
        "*"
      );
    }

    // 页面加载完成后发送高度
    window.addEventListener("load", sendHeight);
    // 当窗口大小改变时发送高度
    window.addEventListener("resize", sendHeight);
    // 定期检查高度变化
    setInterval(sendHeight, 500);
  // } else {
  //   alert.log('沒有設置模組');
  //   $(".intro-content.intro-coupon-modal__content").show();
  //   $(".intro-content.intro-modal__content").hide();
  //   // $(".intro-content.intro-coupon-modal__content").hide();
  //   // $(".intro-content.intro-modal__content").show();
  // }
};

// 啟動特定容器的打字效果
function startTypewriterEffect(containerRoute) {
  const targetRoute = containerRoute.replaceAll(" ", "");
  const typewriterContainer = document.querySelector(`.typewriter-${targetRoute}`);
  
  if (typewriterContainer && typeof Typewriter !== 'undefined') {
    // 獲取要顯示的內容
    let content = typewriterContainer.getAttribute('data-content');
    
    // 如果沒有 data-content 屬性，嘗試從其他地方獲取
    if (!content) {
      content = typewriterContainer.textContent || typewriterContainer.innerText || '';
    }
    
    // 如果還是沒有內容，嘗試從描述容器獲取
    if (!content) {
      const descContainer = document.querySelector(`#container-${targetRoute} .desc-container`);
      if (descContainer) {
        content = descContainer.textContent || descContainer.innerText || '';
      }
    }

    // 檢查標籤是否已經完成了動畫
    const tagElements = document.querySelectorAll(`#container-${targetRoute} .axd_selection.axd_tag`);
    const allTagsHaveFadeIn = Array.from(tagElements).every(tag => tag.classList.contains('tag-fade-in'));
    
    // 如果所有標籤都已經有 tag-fade-in 類，說明動畫已經完成，不需要重新播放
    if (allTagsHaveFadeIn && tagElements.length > 0) {
      // console.log(`🎭 容器 ${targetRoute} 的標籤動畫已完成，跳過重新播放`);
      
      // 確保打字效果容器也是完成狀態
      const swiperSlides = document.querySelectorAll(`#container-${targetRoute} .swiper-wrapper .swiper-slide`);
      swiperSlides.forEach(slide => {
        slide.classList.add('typewriter-complete');
      });
      
      // 直接顯示內容，不重新打字
      if (content && content.trim() !== '' && content !== 'undefined') {
        typewriterContainer.innerHTML = content.trim();
      } else {
        typewriterContainer.innerHTML = '';
      }
      return;
    }

    // 按順序淡入標籤的函數
    function fadeInTagsSequentially(tagElements, delay = 200) {
      return new Promise((resolve) => {
        if (tagElements.length === 0) {
          resolve();
          return;
        }
        
        // 獲取選項容器
        const optionsContainer = document.querySelector(`#container-${targetRoute} .axd_selections.selection`);
        
        let index = 0;
        function fadeInNext() {
          if (index < tagElements.length) {
            const currentTag = tagElements[index];
            currentTag.classList.add('tag-fade-in');
            
            // 自動滾動到當前標籤（只在必要時進行）
            if (optionsContainer && currentTag && index >= 2) { // 只從第3個標籤開始檢查滾動
              // 等待標籤動畫完成後再滾動
              setTimeout(() => {
                // 計算當前標籤在容器中的位置
                const tagRect = currentTag.getBoundingClientRect();
                const containerRect = optionsContainer.getBoundingClientRect();
                
                // 檢查標籤是否在可視區域內
                const isTagVisible = (
                  tagRect.top >= containerRect.top &&
                  tagRect.bottom <= containerRect.bottom
                );
                
                if (!isTagVisible) {
                  // 滾動到標籤位置
                  const tagOffsetTop = currentTag.offsetTop;
                  const containerHeight = optionsContainer.clientHeight;
                  const tagHeight = currentTag.offsetHeight;
                  
                  // 計算滾動位置，確保標籤在可視區域內
                  let scrollPosition;
                  
                  if (tagRect.bottom > containerRect.bottom) {
                    // 標籤在下方，向下滾動
                    scrollPosition = tagOffsetTop - containerHeight + tagHeight + 10; // 留10px邊距
                  } else if (tagRect.top < containerRect.top) {
                    // 標籤在上方，向上滾動
                    scrollPosition = tagOffsetTop - 10; // 留10px邊距
                  }
                  
                  if (scrollPosition !== undefined) {
                    optionsContainer.scrollTo({
                      top: Math.max(0, scrollPosition),
                      behavior: 'smooth'
                    });
                  }
                }
              }, 400); // 等待動畫完全完成(0.4s)
            }
            
            index++;
            setTimeout(fadeInNext, delay);
          } else {
            resolve();
          }
        }
        fadeInNext();
      });
    }
    
    // 檢查是否需要滾動的函數
    function checkAndScrollIfNeeded() {
      if (typewriterContainer.scrollHeight > typewriterContainer.clientHeight) {
        // 如果內容超出容器高度，滾動到底部
        typewriterContainer.scrollTop = typewriterContainer.scrollHeight - typewriterContainer.clientHeight;
      }
    }
    
    // 確保有內容才啟動打字效果
    if (content && content.trim() !== '' && content !== 'undefined') {
      // 只有在動畫未完成時才重置狀態
      // console.log(`🎭 開始容器 ${targetRoute} 的動畫序列`);
      
      // 清空容器內容，準備重新打字
      typewriterContainer.innerHTML = '';
      
      // 重置所有標籤狀態
      const swiperSlides = document.querySelectorAll(`#container-${targetRoute} .swiper-wrapper .swiper-slide`);
      
      swiperSlides.forEach(slide => {
        slide.classList.remove('typewriter-complete');
      });
      
      tagElements.forEach(tag => {
        tag.classList.remove('tag-fade-in');
      });
      
      // 創建打字機實例
      const typewriter = new Typewriter(typewriterContainer, {
        delay: 75,
        cursor: '',  // 不顯示游標
        loop: false,
        // 自定義回調函數在每次字符輸入後檢查滾動
        onPause: checkAndScrollIfNeeded,
        onType: checkAndScrollIfNeeded
      });
      
      // 開始打字效果，並在完成後顯示 swiper-slide 元素和標籤依序淡入
      typewriter
        .typeString(content.trim())
        .pauseFor(500)
        .callFunction(() => {
          // 最終滾動檢查
          checkAndScrollIfNeeded();
          
          // 打字效果完成後，先顯示容器
          const swiperSlides = document.querySelectorAll(`#container-${targetRoute} .swiper-wrapper .swiper-slide`);
          swiperSlides.forEach(slide => {
            slide.classList.add('typewriter-complete');
          });
          
          // 然後讓標籤按順序依序淡入
          const tagElements = document.querySelectorAll(`#container-${targetRoute} .axd_selection.axd_tag`);
          fadeInTagsSequentially(tagElements, 200); // 每個標籤間隔 200ms
        })
        .start();
        
      // 監聽打字過程中的滾動事件
      const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList' || mutation.type === 'characterData') {
            checkAndScrollIfNeeded();
          }
        });
      });
      
      // 開始觀察
      observer.observe(typewriterContainer, {
        childList: true,
        subtree: true,
        characterData: true
      });
      
      // 打字完成後停止觀察
      setTimeout(() => {
        observer.disconnect();
      }, content.length * 95 + 1000); // 根據打字速度估算完成時間
      
    } else {
      // 如果沒有內容，檢查標籤是否已經完成了動畫
      if (allTagsHaveFadeIn && tagElements.length > 0) {
        // console.log(`🎭 容器 ${targetRoute} 的標籤動畫已完成，跳過重新播放（無內容情況）`);
        
        // 確保容器狀態正確
        const swiperSlides = document.querySelectorAll(`#container-${targetRoute} .swiper-wrapper .swiper-slide`);
        swiperSlides.forEach(slide => {
          slide.classList.add('typewriter-complete');
        });
        
        typewriterContainer.innerHTML = '';
        return;
      }
      
      // 如果動畫未完成，直接顯示空內容並顯示 swiper-slide 元素和標籤
      // console.log(`🎭 開始容器 ${targetRoute} 的動畫序列（無內容情況）`);
      typewriterContainer.innerHTML = '';
      
      const swiperSlides = document.querySelectorAll(`#container-${targetRoute} .swiper-wrapper .swiper-slide`);
      swiperSlides.forEach(slide => {
        slide.classList.add('typewriter-complete');
      });
      
      // 標籤按順序依序淡入
      fadeInTagsSequentially(tagElements, 200);
    }
  }
}

const fetchData = async () => {
  // 背景圖片懶加載
  function lazyLoadBackgroundImage() {
    const bgImage = new Image();
    // bgImage.src = 'https://images.unsplash.com/photo-1533750204176-3b0d38e9ac1e?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&w=480';
    bgImage.src = 'https://picsum.photos/600';
    bgImage.onload = function() {
      // 圖片加載完成後，為所有 animX 容器添加 bg-loaded 類別
      const animXContainers = document.querySelectorAll('.container.mbinfo.animX');
      animXContainers.forEach(container => {
        container.classList.add('bg-loaded');
      });
    };
    
    bgImage.onerror = function() {
      // 圖片加載失敗時的處理（可選）
      console.warn('Background image failed to load');
    };
  }
  
  // 延遲一點時間再開始加載背景圖片，確保不影響初始加載速度
  setTimeout(lazyLoadBackgroundImage, 500);
  
  const options = { method: "GET", headers: { accept: "application/json" } };
  try {
    var obj;
    // 塞空值
    const response = await fetch(
      "https://xjsoc4o2ci.execute-api.ap-northeast-1.amazonaws.com/v0/extension/run_routeproduct?Brand=" +
        Brand +
        "&Route=" +
        Route,
      options
    );
    
    // 檢查狀態碼，如果是 200 則發送 postMessage
    if (response.status == 200) {
      const messageData = {
        type: "run_routeproduct_success",
        status: response.status,
        brand: Brand,
        route: Route
      };
      window.parent.postMessage(messageData, "*");
    }
    
    const data = await response.json();
    // $("#loadingbar").hide();
    $("#pback").show();
    $("#containerback").show();
    $("#intro_page").show();
    obj = data;
    if (!obj.Product) return;
    current_Route = obj.Product["Route"] || "";
    all_Route = obj.Product["TagGroups_order"] || [];
    SpecifyTags = obj.Product["SpecifyTags"] || [];
    SpecifyKeywords = obj.Product["SpecifyKeywords"] || [];
    themeBackgroundImages = ['https://images.unsplash.com/photo-1743630738181-b0e26c76c74c?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D','https://images.unsplash.com/photo-1606335567422-09b986cc47bb?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D','https://plus.unsplash.com/premium_photo-1664301332055-8792841f3dc7?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 'https://images.unsplash.com/photo-1630945386735-372fbe731e3f?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 'https://images.unsplash.com/photo-1593504197189-c0dafb6f2e92?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D', 'https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=600&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D']

    const themeBackgroundImagesMap = (() => {
      const product = obj?.Product;
      const order = Array.isArray(product?.TagGroups_order)
        ? product.TagGroups_order
        : [];
      const productMedias = Array.isArray(product?.TagGroups_Medias)
        ? product.TagGroups_Medias
        : [];
      
      // 建立補充後的背景圖片陣列
      const backgroundImages = order.map((key, index) => {
        // 如果 productMedias 中對應位置的值是空字串、null、undefined 或不存在
        const productMedia = productMedias[index];
        if (!productMedia || productMedia.trim() === '') {
          // 隨機從 themeBackgroundImages 中選擇一張圖片補充
          const randomIndex = Math.floor(Math.random() * themeBackgroundImages.length);
          return themeBackgroundImages[randomIndex] || themeBackgroundImages[0];
        }
        return productMedia;
      });
      
      return order.reduce((map, key, index) => {
        if (backgroundImages[index] != null) {
          // 排除 undefined 或 null
          map[key] = backgroundImages[index];
        }
        return map;
      }, {});
    })();
    const formatTagGroupMap = (() => {
      const product = obj?.Product;
      $("#intro-coupon-modal__footer-content-text").text(product?.Name || "開啟個人化購物之旅");

      const order = Array.isArray(product?.TagGroups_order)
        ? product.TagGroups_order
        : [];
      const descriptions = Array.isArray(product?.TagGroups_Description)
        ? product.TagGroups_Description
        : [];
      return order.reduce((map, key, index) => {
        if (descriptions[index] != null) {
          // 排除 undefined 或 null
          map[key] = descriptions[index];
        }
        return map;
      }, {});
    })();
    // 比較當前路線是否已存在
    var INFS_ROUTE_ORDER = !isForPreview
      ? JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) || []
      : [];
    var INFS_ROUTE_RES = !isForPreview
      ? JSON.parse(localStorage.getItem(`INFS_ROUTE_RES_${Brand}`)) || []
      : [];
    // 當前路線
    current_route_path = {
      Route: current_Route,
      TagGroups_order: all_Route,
      Record: {},
    };
    // 過濾相符的物件
    let match;
    if (isFirst && !isForPreview) {
      isFirst = false;
      match = INFS_ROUTE_RES.find((item) =>
        deepEqualWithoutKey(item, current_route_path, ["Record"])
      );
      if (!match) {
        match = INFS_ROUTE_ORDER.find((item) =>
          deepEqualWithoutKey(item, current_route_path, ["Record"])
        );
      }

      if (match) {
        tags_chosen = match.Record;
      } else {
        INFS_ROUTE_ORDER.push(current_route_path);
        if (!isForPreview) {
          localStorage.setItem(
            `INFS_ROUTE_ORDER_${Brand}`,
            JSON.stringify(INFS_ROUTE_ORDER)
          );
        }
      }
    }

    let Route_in_frame = {};
    for (var n = 0; n < all_Route.length; n++) {
      Route_in_frame[all_Route[n]] = [];
    }
    for (var j = 0; j < obj.RouteConfig.length; j++) {
      let item = obj.RouteConfig[j];
      // let idx = all_Route.indexOf(item.TagGroup.S)
      Route_in_frame[item.TagGroup.S].push(item);
    }
    // console.error(Route_in_frame, "dog");
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipod|phone/.test(userAgent);

    const iconNext = isMobile
      ? "data:image/svg+xml;charset=UTF-8,%3csvg width='36' height='37' viewBox='0 0 36 37' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M18 11.0264L10.8 18.2264L18 25.4264' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M25.2 18.2266H10.8' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e"
      : "data:image/svg+xml;charset=UTF-8,%3csvg width='36' height='37' viewBox='0 0 36 37' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M18 11.0264L10.8 18.2264L18 25.4264' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3cpath d='M25.2 18.2266H10.8' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3e%3c/svg%3e";

    for (var r in Route_in_frame) {
      // console.log("TagGroup : " + r);
      document.getElementById("pback").insertAdjacentHTML(
        "beforebegin",
        `<div class='container mbinfo animX animFadeIn update_delete' id="container-${r.replaceAll(
          " ",
          ""
        )}">
                    <div class="c_header" id="container-x-header">
                        
                        <img class="type_backarrow" id="container-${r.replaceAll(
                          " ",
                          ""
                        )}-backarrow" src="${iconNext}" width="100%"
                        height="100%" >
                        <div class="header-text" style="opacity: 0;" >
                            <span style="margin-bottom: 0.3em">${r}</span>
                            <p class="desc-container">${
                              formatTagGroupMap?.[r] ??
                              (Array.isArray(Route_in_frame?.[r]) &&
                              Route_in_frame[r].length > 0
                                ? Route_in_frame[r][0]?.Description?.S ?? ""
                                : "")
                            }</p>
                        </div>
                        <img class='c-${r.replaceAll(
                          " ",
                          ""
                        )} skip icon-next type_backarrow flipped-image' src="${iconNext}" width="100%"
                        height="100%" >
                    </div>

                        <div style="margin: auto" class="selection_scroll slide swiper-container-${r.replaceAll(
                          " ",
                          ""
                        )}">
                            <div class="swiper-wrapper" >
                            </div>         
                        </div>
                    
                         <div class="pagination-${r.replaceAll(
                           " ",
                           ""
                         )} pag-margin dot-btns" style="text-align: center; ">
                        </div>
                     <div class="con-footer">
                        <a class='c-${r.replaceAll(" ", "")} skip'>略過</a>
                     </div>
                       
                    </div>`
      );
      $(`#container-${r.replaceAll(" ","")}`).find(`.swiper-container-${r.replaceAll(" ","")}`).prepend(`
          <p class="tag-desc-container typewriter typewriter-${r.replaceAll(" ", "")}" data-content="${
            formatTagGroupMap?.[r] && formatTagGroupMap[r] !== ""
            ? formatTagGroupMap[r]
            : (
                Array.isArray(Route_in_frame?.[r]) && Route_in_frame[r].length > 0
                  ? (Route_in_frame[r][0]?.Description?.S?.trim() ? Route_in_frame[r][0].Description.S : r)
                  : ""
              )
     }"></p>`)
     $(`#container-${r.replaceAll(" ","")}`).css({backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url(${themeBackgroundImagesMap[r]})`});
      //first route hide type_backarrow
      if (r === all_Route[0]) {
        // document.getElementById(
        //   `container-${r.replaceAll(" ", "")}-backarrow`
        // ).style.visibility = "hidden";

       const backarrow = document.getElementById(
          `container-${r.replaceAll(" ", "")}-backarrow`
        )
        $(backarrow).on(tap, function () {
          $("#intro-page").show();
          $("#container-" + all_Route[0]).hide();
          tags_chosen = {};
        });
      }

      const mediaQuery = window.matchMedia("(max-width: 400px)");
      function handleMediaQueryChange(mediaQuery, tar) {
        // console.log(tar)
        init(tar);
      }

      // 初始檢查
      function init(tar) {
        var target = tar.replaceAll(" ", "");
        $(`#container-${target}`).find(".selection").remove();
        $(`#container-${target}`).find(".remove-button").remove();
        $(`#container-${target}`).find(`.pagination-${target}`).empty();

        const itemCount = Route_in_frame[tar].length;
        const render_num =itemCount
        $(`#container-${target}`)
          .find(".swiper-wrapper")
          .append(
            '<div class="selection swiper-slide"><div class="axd_selections selection"></div></div>'
          );
        for (let rr = 0; rr < render_num; rr++) {
          $(`#container-${target}`).find(".axd_selections").append(`
                            <div class="axd_selection axd_tag">
                                <div class="axd_tag_inner c-${target} tagId-${Route_in_frame[target][rr].Tag.S}">
                                    <p>${Route_in_frame[target][rr].Name.S}</p>
                                </div>
                            </div>
                        `);
        }
        bind();
      }
      init(r);
    }

    var mytap = window.ontouchstart === null ? "touchend" : "click";

    function bind() {
      // 檢查是否所有問題都已完成，如果是則直接跳到結果頁面
      var INFS_ROUTE_ORDER = !isForPreview
        ? JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) || []
        : [];
      const match = INFS_ROUTE_ORDER.find((item) =>
        deepEqualWithoutKey(item, current_route_path, ["Record"])
      );
      const skipShowResult = isForPreview || isForReferral;
      
      if (match && !skipShowResult) {
        tags_chosen = match.Record;
        
        // 檢查是否所有路由都有有效的選擇
        const allRoutesCompleted = all_Route.every(route => {
          const routeKey = route.replaceAll(" ", "");
          return tags_chosen[routeKey] && 
                 tags_chosen[routeKey].length > 0 && 
                 tags_chosen[routeKey][0].Name !== "example";
        });
        
        if (allRoutesCompleted) {
          // 所有問題都已完成，直接跳到結果頁面
          $("#intro-page").hide();
          const hasRes = document.querySelector("#container-recom .update_delete") !== null;
          const get_recom_res_throttled = throttle(get_recom_res, 3000);
          
          if (!hasRes) {
            get_recom_res_throttled();
          }
          return; // 提前返回，不執行後續的 for 循環
        }
      }
      
      for (var fs = 0; fs < all_Route.length; fs++) {
        (function (fs) {
          const currentRoute = all_Route[fs].replaceAll(" ", "");
          // 檢查並設定預設值
          var INFS_ROUTE_ORDER = !isForPreview
            ? JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) ||
              []
            : [];
          const match = INFS_ROUTE_ORDER.find((item) =>
            deepEqualWithoutKey(item, current_route_path, ["Record"])
          );
          const skipShowResult = isForPreview || isForReferral;
          if (match && !skipShowResult) {
            tags_chosen = match.Record;
          }
          if (skipShowResult) {
            tags_chosen = {};
          }
          
          // 檢查當前路由是否已完成
          const currentRouteCompleted = tags_chosen[currentRoute] && 
                                      tags_chosen[currentRoute].length > 0 && 
                                      tags_chosen[currentRoute][0].Name !== "example";
          
          if (
            (Object.keys(tags_chosen).length > 0 && !isForPreview) ||
            (Object.keys(tags_chosen).length > 0 && !isForReferral)
          ) {
            if (currentRouteCompleted) {
              // 如果當前路由已完成，跳過顯示，直接觸發點擊
              if (fs === 0) {
                $("#intro-page").hide();
              }
              const preset = tags_chosen[currentRoute][0];
              const tagIdClass = `tagId-${preset.Tag}`;
              const container = $(`#container-${currentRoute}`);
              const presetElement = container.find(
                `.c-${currentRoute}.${tagIdClass}`
              );
              if (presetElement.length > 0) {
                presetElement.addClass("tag-selected");
                // 直接觸發點擊，不顯示容器
                setTimeout(() => {
                  presetElement.trigger("click");
                }, 100);
              } else {
                $(".c-" + currentRoute + ".skip").click();
              }
            } else if (fs === 0 || !currentRouteCompleted) {
              // 只顯示第一個未完成的問題
              const firstIncompleteIndex = all_Route.findIndex(route => {
                const routeKey = route.replaceAll(" ", "");
                return !(tags_chosen[routeKey] && 
                        tags_chosen[routeKey].length > 0 && 
                        tags_chosen[routeKey][0].Name !== "example");
              });
              
              if (fs === firstIncompleteIndex) {
                // console.log("firstIncompleteIndex", firstIncompleteIndex);
                $("#intro-page").hide();
                $("#container-" + currentRoute).show();
                startTypewriterEffect(all_Route[fs]);
              }
            }
          } else if (fs === 0) {
            // 沒有預設選擇時，顯示第一個問題
            // 這個邏輯會在 start-button 點擊時處理
          }

          $(".c-" + currentRoute + ".skip")
            .off(mytap)
            .on(mytap, function (e) {
              // console.error("$(this) SKIP", $(this));
              // if ($(this).text() == "略過") {
              var tag = `c-${all_Route[fs]}`;
              $(`.${tag}.tag-selected`).removeClass("tag-selected");
              $(".tag-selected").removeClass("tag-selected");
              tags_chosen[all_Route[fs].replaceAll(" ", "")] = [
                {
                  Description: "example",
                  Imgsrc: "https://example.com/imageB1.png",
                  Name: "example",
                  Tag: tag,
                  TagGroup: all_Route[fs],
                },
              ];
              // 修改符合條件的物件後更新 INFS_ROUTE_ORDER
              var INFS_ROUTE_ORDER = !isForPreview
                ? JSON.parse(
                    localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)
                  ) || []
                : [];
              INFS_ROUTE_ORDER.forEach((item, index) => {
                if (deepEqualWithoutKey(item, current_route_path, ["Record"])) {
                  INFS_ROUTE_ORDER[index] = {
                    ...item,
                    Record: tags_chosen, // 修改 Record
                  };
                }
              });
              if (!isForPreview) {
                localStorage.setItem(
                  `INFS_ROUTE_ORDER_${Brand}`,
                  JSON.stringify(INFS_ROUTE_ORDER)
                );
              }
              // console.error("error skip add", tags_chosen);
              // }
              // console.log("skip", all_Route[fs]);
              if (fs == all_Route.length - 1) {
                $("#container-" + currentRoute).hide();
                if ($.isEmptyObject(tags_chosen)) {
                  var firstEl = $("#container-" + all_Route[fs])
                    .find(".image-container")
                    .first();
                  var tagid = firstEl.attr("class").match(/tagId-(\d+)/)[1];
                  // console.warn("tagid", tagid);
                  tags_chosen[all_Route[fs].replaceAll(" ", "")] = [
                    {
                      Description: "example",
                      Imgsrc: "https://example.com/imageB1.png",
                      Name: "example",
                      Tag: tagid,
                      TagGroup: all_Route[fs],
                    },
                  ];
                }
                get_recom_res();
              } else {
                // console.log(".c-" + all_Route[fs + 1].replaceAll(" ", ""));
                $("#container-" + currentRoute).hide();
                $("#container-" + all_Route[fs + 1].replaceAll(" ", "")).show();
                // 啟動下一個容器的打字效果
                startTypewriterEffect(all_Route[fs + 1]);
              }
            });

          $(".c-" + currentRoute + ":not(.skip)")
            .off("click")
            .on("click", function (e) {
              var tagid = $(this)
                .attr("class")
                .match(/tagId-(\d+)/)[1];

              var tag = `c-${all_Route[fs]}`;
              $(`.${tag}.tag-selected`).removeClass("tag-selected");
              $(this).addClass("tag-selected");
              if (fs == all_Route.length - 1) {
                $("#container-" + currentRoute).hide();

                tags_chosen[all_Route[fs].replaceAll(" ", "")] = [
                  {
                    Description: $(
                      `#container-${all_Route[fs]} .desc-container`
                    )
                      .first()
                      .text(),
                    Imgsrc: $(this).find("img").attr("src"),
                    Name: $(this).find("p").text(),
                    Tag: tagid,
                    TagGroup: all_Route[fs],
                  },
                ];
                const hasRes =
                  document.querySelector("#container-recom .update_delete") !==
                  null;
                const get_recom_res_throttled = throttle(get_recom_res, 3000);

                if (!hasRes) {
                  get_recom_res_throttled();
                }
              } else {
                $("#container-" + currentRoute).hide();
                $("#container-" + all_Route[fs + 1].replaceAll(" ", "")).show();
                // 啟動下一個容器的打字效果
                startTypewriterEffect(all_Route[fs + 1]);
                tags_chosen[all_Route[fs].replaceAll(" ", "")] = [
                  {
                    Description: $(
                      `#container-${all_Route[fs]} .desc-container`
                    )
                      .first()
                      .text(),
                    Imgsrc: $(this).find("img").attr("src"),
                    Name: $(this).find("p").text(),
                    Tag: tagid,
                    TagGroup: all_Route[fs],
                  },
                ];
              }
              // 修改符合條件的物件後更新 INFS_ROUTE_ORDER
              var INFS_ROUTE_ORDER =
                JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) ||
                [];
              INFS_ROUTE_ORDER.forEach((item, index) => {
                if (deepEqualWithoutKey(item, current_route_path, ["Record"])) {
                  INFS_ROUTE_ORDER[index] = {
                    ...item,
                    Record: tags_chosen, // 修改 Record
                  };
                }
              });
              if (!isForPreview) {
                localStorage.setItem(
                  `INFS_ROUTE_ORDER_${Brand}`,
                  JSON.stringify(INFS_ROUTE_ORDER)
                );
              }
            });
          $(`#container-${all_Route[fs].replaceAll(" ", "")}-backarrow`).on(
            mytap,
            function (e) {
              if (fs != 0) {
                $("#container-" + currentRoute).hide();
                $("#container-" + all_Route[fs - 1].replaceAll(" ", "")).show();
                // 啟動上一個容器的打字效果
                startTypewriterEffect(all_Route[fs - 1]);
              }
            }
          );

          if (fs == 0) {
            reset = async function () {
              const message = {
                header: "from_preview",
                id: Route,
                brand: Brand,
              };

              // 發送消息到接收窗口
              window.dispatchEvent(
                new MessageEvent("message", { data: message })
              );
              const messageData = {
                type: "result",
                value: false,
              };
              window.parent.postMessage(messageData, "*");
              tags_chosen = {};
            };
          }
        })(fs);
      }
    }
    bind();

    var pass_data = {
      MsgHeader: "fetchDone",
    };
    window.parent.postMessage(pass_data, "*");
  } catch (error) {
    console.error("Fetch error:", error);
  }
};
var tap = window.ontouchstart === null ? "touchend" : "click";

// 使用事件委託來處理動態創建的圖標元素
$(document).on(tap, ".icon-inffits", function () {
  $(".icon-inffits").toggleClass("open");
  $(".text-inffits").toggleClass("visible");
  $(".icon-reminder").removeClass("open");
  $(".text-reminder").removeClass("visible");
});
$(document).on(tap, ".icon-reminder", function () {
  $(".icon-reminder").toggleClass("open");
  $(".text-reminder").toggleClass("visible");
  $(".icon-inffits").removeClass("open");
  $(".text-inffits").removeClass("visible");
});

function copyCoupon(couponCode, btn) {
  navigator.clipboard
    .writeText(couponCode)
    .then(() => {
      // console.log("已複製優惠碼：", couponCode);
      const $btn = $(btn);
      const $parent = $btn.closest(
        ".intro-coupon-modal__content-container-content-footer"
      );
      const $copiedBtn = $parent.find(
        ".intro-coupon-modal__btn--coupon--copied"
      );

      // 切換按鈕顯示
      $btn.hide();
      $copiedBtn.show();

      setTimeout(() => {
        $btn.show();
        $copiedBtn.hide();
      }, 3000);
    })
    .catch((err) => {
      console.error("複製失敗：", err);
      alert("無法複製優惠碼，請手動複製。");
    });
}

// 使用事件委託來處理動態創建的元素
$(document).on(tap, "#start-button", function () {
  $("#recommend-title").text("專屬商品推薦");
  $("#recommend-desc").text("根據您的偏好，精選以下單品。"); // 使用淡入動畫
  $("#recommend-btn").text("刷新推薦");
  
  // 檢查是否所有問題都已完成
  var INFS_ROUTE_ORDER = !isForPreview
    ? JSON.parse(localStorage.getItem(`INFS_ROUTE_ORDER_${Brand}`)) || []
    : [];
  const match = INFS_ROUTE_ORDER.find((item) =>
    deepEqualWithoutKey(item, current_route_path, ["Record"])
  );
  
  if (match && !isForPreview && !isForReferral) {
    const savedTags = match.Record;
    const allRoutesCompleted = all_Route.every(route => {
      const routeKey = route.replaceAll(" ", "");
      return savedTags[routeKey] && 
             savedTags[routeKey].length > 0 && 
             savedTags[routeKey][0].Name !== "example";
    });
    
    if (allRoutesCompleted) {
      // 所有問題都已完成，直接跳到結果頁面
      $("#intro-page").hide();
      tags_chosen = savedTags;
      const hasRes = document.querySelector("#container-recom .update_delete") !== null;
      const get_recom_res_throttled = throttle(get_recom_res, 3000);
      
      if (!hasRes) {
        get_recom_res_throttled();
      }
      return; // 提前返回，不顯示第一個問題
    }
  }
  
  // 隱藏介紹頁面，顯示第一個推薦內容頁面
  $("#intro-page").hide();
  $("#container-" + all_Route[0]).show();
  // 啟動第一個容器的打字效果
  startTypewriterEffect(all_Route[0]);
});

$("#recommend-btn").on(tap, async function () {
  $("#loadingbar_recom").hide();

  const $loadingOverlay = $('<div id="loading-overlay"></div>')
    .css({
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background:
        "rgba(255, 255, 255, 0.9) url('./../img/recom-loading-desktop.gif') no-repeat center center / contain",
      zIndex: 9999,
    })
    .appendTo("#container-recom");

  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile = /mobile|android|iphone|ipod|phone/.test(userAgent);
  const backgroundImage = isMobile
    ? "./../img/recom-loading-mobile.gif" // 手機版背景
    : "./../img/recom-loading-desktop.gif"; // 桌面版背景
  $("#loading-overlay").css(
    "background",
    `rgba(255, 255, 255, 0.9) url('${backgroundImage}') no-repeat center center / contain`
  );

  const messageData = {
    type: "result",
    value: true,
  };
  window.parent.postMessage(messageData, "*");
  if (firstResult.Item?.length <= 3) {
    await getEmbedded().finally(() => {
      setTimeout(() => {
        $loadingOverlay.fadeOut(300, function () {
          $(this).remove();
        });
      }, 1000);
    });
  } else {
    show_results(firstResult);
    $("#recommend-title").text("精選推薦商品");
    $("#recommend-desc").text("更多您可能喜愛的商品");

    setTimeout(() => {
      $loadingOverlay.fadeOut(300, function () {
        $(this).remove();
      });
    }, 1000);
  }
});

$("#startover").on(tap, function () {
  $("#loadingbar_recom").hide();
  Initial();
  reset();
});

const Initial = () => {
  $(".update_delete").remove();
  $("#container-recom").hide();

  tags_chosen = {};
};

window.addEventListener("message", async (event) => {
  // console.warn("message", event);
  if (event.data.header == "from_preview") {
    await Initial();

    Route = event.data.id;
    Brand = event.data.brand;

    fetchData();
    fetchCoupon();

    $("#intro-page").fadeIn(800);
  }
});
