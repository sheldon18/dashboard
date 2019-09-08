queue()
    .defer(d3.csv, "data/Salaries.csv")
    .await(makeGraphs);

function makeGraphs(error, salaryData) {
    var ndx = crossfilter(salaryData);
    
    salaryData.forEach(function(d) {     //salary data, years of service is treated as text, hence we loop over all the data and convert the data to integers
        d.salary = parseInt(d.salary);
        d.yrs_since_phd = parseInt(d["yrs.since.phd"]);  
        d.yrs_service = parseInt(d["yrs.service"]);  //wrapping in brackets and not dot as years of service has a dot in it
    })
    
    show_discipline_selector(ndx);
    
    show_percent_that_are_professors(ndx, "Female", "#percent-of-women-professors");
    show_percent_that_are_professors(ndx, "Male", "#percent-of-men-professors");
    
    show_gender_balance(ndx);
    show_average_salaries(ndx);
    show_rank_distribution(ndx);
    
    show_service_to_salary_correlation(ndx);
    show_phd_to_salary_correlation(ndx);
    
    
    
    dc.renderAll();
}    

function show_discipline_selector(ndx) {
    dim = ndx.dimension(dc.pluck('discipline'));
    group = dim.group()
    
    dc.selectMenu("#discipline-selector")
        .dimension(dim)
        .group(group);
}


function show_percent_that_are_professors(ndx, gender, element) {
    var percentageThatAreProf = ndx.groupAll().reduce(
        function (p, v) {    //add function
            if (v.sex === gender) {
                p.count++;
                if (v.rank === "Prof") {
                    p.are_prof++;
                }
            }
            return p;
                
        },
        function (p, v) {   //remove function
            if (v.sex === gender) {
                p.count--;
                if (v.rank === "Prof") {
                    p.are_prof--;
                }
            }
            return p;
        },
        function () {        //initialize function takes no arguments
            return {count: 0, are_prof: 0};     //similar to properties in the stack barChart
        }
    
    );
        
    dc.numberDisplay(element)
        .formatNumber(d3.format(".2%"))
        .valueAccessor(function (d) {
            if (d.count == 0) {
                return 0;
            } else {
                return (d.are_prof / d.count);
            }
        })
        .group(percentageThatAreProf);
}



function show_gender_balance(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    var group = dim.group();
    
    dc.barChart('#gender-balance')
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(group)
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .xAxisLabel("Gender")
        .yAxis().ticks(20);
}


function show_average_salaries(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    
    function add_item(p, v) {
        p.count++;
        p.total += v.salary;
        p.average = p.total / p.count;
        return p;
    }
    
    function remove_item(p, v) {     //then passed into customer reducer (opposite of in-built)
        p.count--;
        if(p.count == 0) {
            p.total = 0;
            p.average = 0;
        } else {
        p.total -= v.salary;
        p.average = p.total / p.count;
        }
        return p;
    }
    
    function initialise() {
        return {count: 0, total: 0, average: 0};
    }
    
    var averageSalaryByGender = dim.group().reduce(add_item, remove_item, initialise);  //customer reducer
    
    dc.barChart("#average-salary")
        .width(350)
        .height(250)
        .margins({top: 10, right: 50, bottom: 30, left: 50})
        .dimension(dim)
        .group(averageSalaryByGender)
        .valueAccessor(function(d){    //becasue we used a custoemr reducer
            return d.value.average.toFixed(2);   //rouding decimals
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xUnits(dc.units.ordinal)
        .elasticY(true)
        .xAxisLabel("Gender")
        .yAxis().ticks(4);
}    

function show_rank_distribution(ndx) {
    var dim = ndx.dimension(dc.pluck('sex'));
    
    /*   var profByGender = dim.group().reduce(     //customer reducer in-built specific to professor only which can be deleted as general function created
        function (p, v) {
            p.total++;
            if(v.rank == "Prof") {
                p.match++;
            }
            return p
            
        },
        function (p, v) {
            p.total--;
            if(v.rank == "Prof") {
                p.match--;
            }
            return p
        },
        function () {
            return {total: 0, match: 0};
        }
        
    );    */
    
    function rankByGender (dimension, rank) {
        return dimension.group().reduce(     //generalized function
        function (p, v) {
            p.total++;
            if(v.rank == rank) {
                p.match++;
            }
            return p
            
        },
        function (p, v) {
            p.total--;
            if(v.rank == rank) {
                p.match--;
            }
            return p
        },
        function () {
            return {total: 0, match: 0};
        }
        
    );
    }
    
    var profByGender = rankByGender (dim, "Prof");
    var asstProfByGender = rankByGender (dim, "AsstProf");
    var assocProfByGender = rankByGender (dim, "AssocProf");
    
   // console.log(profByGender.all());    //to see results in console.log
    
    dc.barChart("#rank-distribution")
        .width(350)
        .height(250)
        
        .dimension(dim)
        .group(profByGender, "Prof")
        .stack(asstProfByGender, "Asst Prof")
        .stack(assocProfByGender, "Assoc Prof")
        .valueAccessor(function (d) {
            if(d.value.total > 0) {
                return (d.value.match / d.value.total) * 100;
            } else {
                return 0;
            }
        })
        .transitionDuration(500)
        .x(d3.scale.ordinal())
        .xAxisLabel("Gender")
        .xUnits(dc.units.ordinal)
        .legend(dc.legend().x(320).y(20).itemHeight(15).gap(5))
        .margins({top: 10, right: 100, bottom: 30, left: 30})
       
    
}

function show_service_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var eDim = ndx.dimension(dc.pluck("yrs_service"));
    var experienceDim = ndx.dimension(function (d) {
        return [d.yrs_service, d.salary, d.rank, d.sex];    //yrs_service to plot the x co-ordinate of the dot, salary is the y co-ordinate
        
    })
    
    var experienceSalaryGroup = experienceDim.group();
    
    var minExperience = eDim.bottom(1)[0].yrs_service;
    var maxExperience = eDim.top(1)[0].yrs_service;
    
    dc.scatterPlot("#service-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minExperience, maxExperience]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel("Salary")
        .xAxisLabel("Years of Service")
        .title(function (d) {
            return d.key[2] + " earned " + d.key[1];  //1 is the second item in the array on line 223 and hence refers to Salary
        })
        .colorAccessor(function (d) {
             return d.key[3];    //because sex is the 4th in the array on line 229
        })
        .colors(genderColors)
        .dimension(experienceDim)
        .group(experienceSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
        
        
            
        
        
}

function show_phd_to_salary_correlation(ndx) {
    
    var genderColors = d3.scale.ordinal()
        .domain(["Female", "Male"])
        .range(["pink", "blue"]);
    
    var pDim = ndx.dimension(dc.pluck("yrs_since_phd"));
    var phdDim = ndx.dimension(function (d) {
        return [d.yrs_since_phd, d.salary, d.rank, d.sex];    
        
    })
    
    var phdSalaryGroup = phdDim.group();
    
    var minPhd = pDim.bottom(1)[0].yrs_since_phd;
    var maxPhd = pDim.top(1)[0].yrs_since_phd;
    
    dc.scatterPlot("#phd-salary")
        .width(800)
        .height(400)
        .x(d3.scale.linear().domain([minPhd, maxPhd]))
        .brushOn(false)
        .symbolSize(8)
        .clipPadding(10)
        .yAxisLabel("Salary")
        .xAxisLabel("Years since PHD")
        .title(function (d) {
            return d.key[2] + " earned " + d.key[1];  //1 is the second item in the array on line 223 and hence refers to Salary
        })
        .colorAccessor(function (d) {
             return d.key[3];    //because sex is the 4th in the array on line 229
        })
        .colors(genderColors)
        .dimension(phdDim)
        .group(phdSalaryGroup)
        .margins({top: 10, right: 50, bottom: 75, left: 75});
        
        
            
        
        
}

