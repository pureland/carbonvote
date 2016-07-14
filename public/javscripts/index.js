console.log("public/index.js")
function createChart(arr_name,arr_percent) {
  var arr=new Array
  for(let i=0;i<arr_name.length;i++)
  {
    arr.push({
      name:arr_name[i],
      y:arr_percent[i]
    })
  }
  new Highcharts.Chart({
    chart: {
      renderTo: 'CarbonvoteChart',
      plotBackgroundColor: null,
      plotBorderWidth: null,
      plotShadow: false,
      type: 'pie'
    },

    credits: {
      enabled: false
    },
    title: {
      text: 'Vote Status'
    },
    tooltip: {
      pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
    },
    plotOptions: {
      pie: {
        allowPointSelect: true,
        cursor: 'pointer',
        dataLabels: {
          enabled: false
        },
        showInLegend: true
      }
    },
    series: arr,
    colors: ['#99CC66', '#FF6666'],
  })
}

function ajaxLoad(url, callback) {
  var xmlhttp = new XMLHttpRequest();

  xmlhttp.onreadystatechange = function() {
    if (xmlhttp.readyState == XMLHttpRequest.DONE ) {
      if (xmlhttp.status == 200) {
        callback(xmlhttp.responseText)
      }
      else if (xmlhttp.status == 400) {
        console.log('There was an error 400');
      }
      else {
        console.log('something else other than 200 was returned');
      }
    }
  }

  xmlhttp.open("GET", url, true);
  xmlhttp.send();
}

(function() {
  console.log("ajaxLoad")
  ajaxLoad('/vote', function(res) {
      var arr_per =new Array
    var totalvote=0
    var data = JSON.parse(res)
    console.log("chart data",data)
    var arr =Object.keys(data).map(key => data[key])
    for(let i=0;i<arr.length;i++)
      totalvote+=arr[i]
    
    for(let i=0;i<arr.length;i++){
      arr_per.push(Number(arr[i] / totalvote * 100).toFixed())
    }
    console.log(arr)
    createChart(Object.keys(data),arr_per)
  })
})()
