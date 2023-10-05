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

function totalTime(workTime,shortBreak,longBreak, loop){
    var totalTime = (((workTime + shortBreak) * 3) + (workTime + longBreak)) * loop;
            
    totalTime = minToMs(totalTime);
    
    const hours = Math.floor(totalTime / 3600000) % 24
    const minutes = Math.floor(totalTime / 60000) % 60
    const seconds = Math.floor(totalTime / 1000) % 60

    return addZero(hours) + ":" + addZero(minutes) + ":" + addZero(seconds)
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