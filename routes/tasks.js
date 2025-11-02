module.exports = function (router) {
    const Task = require('../models/task');
    const User = require('../models/user');
  
    const tasksRoute = router.route('/tasks');
    const tasksIdRoute = router.route('/tasks/:id');
  
    // GET /api/tasks
    tasksRoute.get(async function (req, res) {
        try {
            const query = Task.find(JSON.parse(req.query.where || '{}'));
            if (req.query.sort) query.sort(JSON.parse(req.query.sort));
            if (req.query.select) query.select(JSON.parse(req.query.select));
            if (req.query.skip) query.skip(parseInt(req.query.skip));
            query.limit(parseInt(req.query.limit) || 100);
            const result = await query.exec();
    
            if (req.query.count === 'true') {
                res.status(200).json({ message: 'OK', data: result.length });
            } else {
                res.status(200).json({ message: 'OK', data: result });
            }
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // POST /api/tasks
    tasksRoute.post(async function (req, res) {
        try {
            if (!req.body.name || !req.body.deadline)
                return res
                    .status(400)
                    .json({ message: 'Missing name or deadline', data: {} });
    
            const newTask = new Task(req.body);
            await newTask.save();
    
            // Add task to assigned user's pendingTasks (if assigned)
            if (newTask.assignedUser) {
                const user = await User.findById(newTask.assignedUser);
                if (user) {
                    user.pendingTasks.push(newTask._id.toString());
                    await user.save();
                }
            }
    
            res.status(201).json({ message: 'Task created', data: newTask });
        } catch (err) {
            res.status(500).json({ message: 'Server error', data: err });
        }
    });
  
    // GET /api/tasks/:id
    tasksIdRoute.get(async function (req, res) {
        try {
            const task = await Task.findById(req.params.id);
            if (!task)
                return res.status(404).json({ message: 'Task not found', data: {} });
            res.status(200).json({ message: 'OK', data: task });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // PUT /api/tasks/:id
    tasksIdRoute.put(async function (req, res) {
        try {
            const task = await Task.findById(req.params.id);
            if (!task)
                return res.status(404).json({ message: 'Task not found', data: {} });
    
            const oldUserId = task.assignedUser;
            const updated = await Task.findByIdAndUpdate(req.params.id, req.body, {
                new: true,
            });
    
            // Remove from old user
            if (oldUserId && oldUserId !== updated.assignedUser) {
                const oldUser = await User.findById(oldUserId);
                if (oldUser) {
                    oldUser.pendingTasks = oldUser.pendingTasks.filter(
                        (id) => id !== updated._id.toString()
                    );
                    await oldUser.save();
                }
            }
    
            // Add to new user
            if (updated.assignedUser && oldUserId !== updated.assignedUser) {
                const newUser = await User.findById(updated.assignedUser);
                if (newUser) {
                    if (!newUser.pendingTasks.includes(updated._id.toString())) {
                        newUser.pendingTasks.push(updated._id.toString());
                        await newUser.save();
                    }
                }
            }
    
            res.status(200).json({ message: 'Task updated', data: updated });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    // DELETE /api/tasks/:id
    tasksIdRoute.delete(async function (req, res) {
        try {
            const deleted = await Task.findByIdAndDelete(req.params.id);
            if (!deleted)
                return res.status(404).json({ message: 'Task not found', data: {} });
    
            // Remove from assigned user's pendingTasks
            if (deleted.assignedUser) {
                const user = await User.findById(deleted.assignedUser);
                if (user) {
                    user.pendingTasks = user.pendingTasks.filter(
                        (id) => id !== deleted._id.toString()
                    );
                    await user.save();
                }
            }
    
            res.status(200).json({ message: 'Task deleted', data: deleted });
        } catch (err) {
            res.status(400).json({ message: 'Bad Request', data: err });
        }
    });
  
    return router;
};
  