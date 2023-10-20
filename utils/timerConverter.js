function msToMin(ms){
    return ms/1000/60;
}

function minToMs(min){
    return min*60*1000;
}

function addZero(i) {
    if (i < 10) {i = "0" + i}
    return i;
}

function totalTime(ms){
    let h = addZero(Math.floor(ms / 1000 / 60 / 60));
    let m = addZero(Math.floor(ms / 1000 / 60) % 60);
    let s = addZero(Math.floor(ms / 1000) % 60);
    return h + ":" + m + ":" + s;
}

function getCurrentHour(){
    const d = new Date();
    let h = addZero(d.getHours());
    let m = addZero(d.getMinutes());
    let s = addZero(d.getSeconds());
    return h + ":" + m + ":" + s;
}

module.exports = {
    msToMin,
    minToMs,
    addZero,
    totalTime,
    getCurrentHour
};